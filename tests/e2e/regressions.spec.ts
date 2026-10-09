import { test, expect, type Page } from "@playwright/test";
import { newProject, type Project } from "../../src/shared/project";
import { randomUUID } from "node:crypto";
import path from "node:path";
async function editor(page: Page, p: Project) {
  const saved: Project[] = [];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url()).pathname;
    if (url.endsWith("/session"))
      return route.fulfill({ json: { token: "test" } });
    if (url.endsWith("/health"))
      return route.fulfill({ json: { ffmpeg: true, chromium: true } });
    if (url === "/api/projects") return route.fulfill({ json: [p] });
    if (url === `/api/projects/${p.id}`) {
      if (route.request().method() === "PUT") {
        saved.push(route.request().postDataJSON());
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: p });
    }
    if (url.includes("/analysis/"))
      return route.fulfill({ json: { fps: 30, bands: 32, frames: [] } });
    if (url.endsWith("/meta"))
      return route.fulfill({ json: { kind: "image" } });
    if (url.includes("/assets/"))
      return route.fulfill({
        path: path.resolve(
          ".local-data/fixtures",
          url.endsWith(p.audioId!) ? "짧은 샘플.mp3" : "background.png",
        ),
      });
    return route.fulfill({
      json: { id: randomUUID(), status: "failed", progress: 0 },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: p.title, exact: true }).click();
  return saved;
}
function project() {
  const p = newProject(randomUUID());
  p.title = "회귀 검증";
  p.audioId = randomUUID();
  p.duration = 3;
  return p;
}
async function pendingUpload(page: Page) {
  let release!: () => void, arrived!: () => void;
  const entered = new Promise<void>((r) => (arrived = r)),
    gate = new Promise<void>((r) => (release = r));
  const id = randomUUID();
  await page.route("**/api/projects/*/assets", async (r) => {
    arrived();
    await gate;
    await r.fulfill({
      json: { id, kind: "image", ext: ".png", originalName: "background.png" },
    });
  });
  return { entered, release: () => release(), id };
}
test("removing a background invalidates its pending replacement", async ({
  page,
}) => {
  const p = project();
  p.backgroundId = randomUUID();
  const saved = await editor(page, p);
  await page.getByRole("button", { name: "배경 편집", exact: true }).click();
  const pending = await pendingUpload(page);
  await page
    .locator(".inspector input[type=file]")
    .first()
    .setInputFiles(path.resolve(".local-data/fixtures/background.png"));
  await pending.entered;
  await page.getByRole("button", { name: "배경 제거", exact: true }).click();
  pending.release();
  await expect(page.getByText("파일 처리 중…", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].backgroundId).toBeUndefined();
});
test("independent cover and background uploads both apply", async ({
  page,
}) => {
  const saved = await editor(page, project());
  await page.getByRole("button", { name: "배경 편집", exact: true }).click();
  const first = await pendingUpload(page);
  await page
    .locator(".inspector input[type=file]")
    .first()
    .setInputFiles(path.resolve(".local-data/fixtures/background.png"));
  await first.entered;
  await page
    .getByRole("button", { name: "플레이어 편집", exact: true })
    .click();
  const second = await pendingUpload(page);
  await page
    .locator(".inspector input[type=file]")
    .first()
    .setInputFiles(path.resolve(".local-data/fixtures/background.png"));
  await second.entered;
  second.release();
  first.release();
  await expect(page.getByText("파일 처리 중…", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].backgroundId).toBe(first.id);
  expect(saved[0].coverId).toBe(second.id);
});
test("export checks overflowing lyrics later in the song", async ({ page }) => {
  const p = project();
  p.lyrics = [
    { start: 0, end: 0.8, original: "첫 구절" },
    { start: 1, end: 1.8, original: "다음 구절" },
    { start: 2, end: 3, original: "긴 가사 ".repeat(1000) },
  ];
  await editor(page, p);
  let warned = false;
  page.on("dialog", async (d) => {
    warned = true;
    await d.dismiss();
  });
  await page
    .getByRole("button", { name: "영상 내보내기", exact: true })
    .click();
  await expect.poll(() => warned).toBe(true);
});
