import { test, expect } from "@playwright/test";
import path from "node:path";
import { newProject } from "../../src/shared/project";
import { applyTemplate } from "../../src/shared/templates";
import { randomUUID } from "node:crypto";

test("initial template choice is saved and switching preserves music and lyrics", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("radio", { name: /회전 앨범/ }).check();
  await page.screenshot({
    path: ".local-data/verification/template-picker.png",
    fullPage: true,
  });
  await page
    .getByTestId("audio-input")
    .setInputFiles(path.resolve(".local-data/fixtures/짧은 샘플.mp3"));
  await page
    .getByRole("button", { name: "플레이어 편집", exact: true })
    .click();
  const title = `템플릿 검증 ${Date.now()}`;
  await page.getByLabel("곡 이름", { exact: true }).fill(title);
  await expect(
    page.getByLabel("원형 커버 크기", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "가사 편집", exact: true }).click();
  await page
    .getByRole("button", { name: "JSON 가져오기", exact: true })
    .click();
  await page.getByLabel("가사 JSON", { exact: true }).fill(
    JSON.stringify({
      lyrics: [{ start: 0, end: 2, original: "기억할 장면" }],
    }),
  );
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await expect(page.getByTestId("save-status")).toHaveText("자동 저장됨");
  const rows = await (await request.get("/api/projects")).json();
  const id = rows.find((r: any) => r.title === title).id;
  const before = await (await request.get(`/api/projects/${id}`)).json();
  expect(before.templateId).toBe("vinyl");
  await page.reload();
  await page.getByRole("button", { name: title, exact: true }).first().click();
  await page.getByRole("button", { name: "파일", exact: true }).click();
  await page.getByRole("button", { name: "템플릿 변경…", exact: true }).click();
  await expect(page.getByRole("radio", { name: /회전 앨범/ })).toBeChecked();
  await page.getByRole("radio", { name: /클래식 가사/ }).check();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "템플릿 변경" })).toBeHidden();
  expect(
    (await (await request.get(`/api/projects/${id}`)).json()).templateId,
  ).toBe("vinyl");
  await page.getByRole("button", { name: "파일", exact: true }).click();
  await page.getByRole("button", { name: "템플릿 변경…", exact: true }).click();
  await page.getByRole("radio", { name: /클래식 가사/ }).check();
  await page.getByRole("button", { name: "템플릿 적용", exact: true }).click();
  await expect(page.getByTestId("save-status")).toHaveText("자동 저장됨");
  const after = await (await request.get(`/api/projects/${id}`)).json();
  expect(after.templateId).toBe("classic");
  expect(after.audioId).toBe(before.audioId);
  expect(after.lyrics).toEqual(before.lyrics);
  expect(after.title).toBe(title);
});

test("vinyl cover rotates deterministically and spectrum grows below both rails", async ({
  page,
}) => {
  const p = applyTemplate(newProject(randomUUID()), "vinyl");
  p.duration = 180;
  p.title = "바람이 머문 자리";
  p.artist = "Lyric Room";
  p.lyrics = [
    {
      start: 0,
      end: 60,
      original: "음악이 머무는 순간",
      pronunciation: "회전하는 커버와 함께",
      translation: "지금의 장면을 기억해",
    },
    { start: 60, end: 120, original: "다음으로 이어지는 이야기" },
  ];
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/render.html");
  const result = await page.evaluate(async (p) => {
    const modulePath = "/src/scene/draw.ts";
    const { drawScene } = await import(modulePath);
    const fontsPath = "/src/scene/media.ts";
    await (await import(fontsPath)).loadFonts(p);
    const cover = document.createElement("canvas");
    cover.width = cover.height = 400;
    const cc = cover.getContext("2d")!;
    cc.fillStyle = "#a4b2bf";
    cc.fillRect(0, 0, 400, 400);
    cc.fillStyle = "#d4c4b0";
    cc.fillRect(0, 0, 190, 400);
    cc.fillStyle = "#383e50";
    cc.fillRect(80, 60, 65, 240);
    const img = new Image();
    img.src = cover.toDataURL();
    await img.decode();
    const canvas = document.querySelector("canvas")!,
      ctx = canvas.getContext("2d")!;
    const spectrum = {
      fps: 30,
      bands: 32,
      frames: Array.from({ length: 240 }, () => Array(32).fill(0.6)),
    };
    const crop = (x: number, y: number, w: number, h: number) =>
      Array.from(ctx.getImageData(x, y, w, h).data);
    drawScene(ctx, p, 0, spectrum, { cover: img });
    const start = crop(840, 240, 240, 240);
    drawScene(ctx, p, 6, spectrum, { cover: img });
    const turned = crop(840, 240, 240, 240);
    drawScene(ctx, p, 0, spectrum, { cover: img });
    const back = crop(840, 240, 240, 240);
    p.style.rotationSeconds = 0;
    drawScene(ctx, p, 6, spectrum, { cover: img });
    const stopped = crop(840, 240, 240, 240);
    const below = crop(330, 390, 1, 1)[0],
      above = crop(330, 320, 1, 1)[0],
      right = crop(1580, 390, 1, 1)[0];
    return {
      rotates: JSON.stringify(start) !== JSON.stringify(turned),
      same: JSON.stringify(start) === JSON.stringify(back),
      stopped: JSON.stringify(start) === JSON.stringify(stopped),
      below,
      above,
      right,
    };
  }, p);
  expect(result.rotates).toBe(true);
  expect(result.same).toBe(true);
  expect(result.stopped).toBe(true);
  expect(result.below).toBeGreaterThan(result.above + 80);
  expect(result.right).toBeGreaterThan(result.above + 80);
  await page.screenshot({
    path: ".local-data/verification/vinyl-template.png",
  });
});

test("template selection fits narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("radio", { name: /회전 앨범/ }).check();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local-data/verification/template-picker-mobile.png",
    fullPage: true,
  });
});
