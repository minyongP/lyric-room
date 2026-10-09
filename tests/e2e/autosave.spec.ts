import { test, expect } from "@playwright/test";
import path from "node:path";
async function open(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page
    .getByTestId("audio-input")
    .setInputFiles(path.resolve(".local-data/fixtures/짧은 샘플.mp3"));
  await page
    .getByRole("button", { name: "플레이어 편집", exact: true })
    .click();
}
test("edits save automatically and survive reloading without a save click", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("곡 이름", { exact: true }).fill("자동 저장 확인");
  await expect(page.getByTestId("save-status")).toHaveText("자동 저장됨");
  await page.reload();
  await page
    .getByRole("button", { name: "자동 저장 확인", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "플레이어 편집", exact: true })
    .click();
  await expect(page.getByLabel("곡 이름", { exact: true })).toHaveValue(
    "자동 저장 확인",
  );
});
test("serializes delayed saves so the most recent edit wins", async ({
  page,
}) => {
  await open(page);
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((r) => (release = r)),
    arrival = new Promise<void>((r) => (entered = r));
  let first = true;
  await page.route("**/api/projects/*", async (route) => {
    if (route.request().method() === "PUT" && first) {
      first = false;
      entered();
      await gate;
    }
    await route.continue();
  });
  await page.getByLabel("곡 이름", { exact: true }).fill("먼저 저장");
  await arrival;
  await page.getByLabel("곡 이름", { exact: true }).fill("마지막 편집");
  release();
  await expect(page.getByTestId("save-status")).toHaveText("자동 저장됨");
  await page.reload();
  await page
    .getByRole("button", { name: "마지막 편집", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "플레이어 편집", exact: true })
    .click();
  await expect(page.getByLabel("곡 이름", { exact: true })).toHaveValue(
    "마지막 편집",
  );
});
test("invalid timing preserves the last valid save and recovers when corrected", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "가사 편집", exact: true }).click();
  await page
    .getByRole("button", { name: "JSON 가져오기", exact: true })
    .click();
  await page.getByLabel("가사 JSON", { exact: true }).fill(
    JSON.stringify({
      lyrics: [{ start: 0.2, end: 2, original: "검증 가사" }],
    }),
  );
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await expect(page.getByTestId("save-status")).toHaveText("자동 저장됨");
  let writes = 0;
  page.on("request", (r) => {
    if (r.method() === "PUT") writes++;
  });
  await page.getByLabel("종료 1", { exact: true }).fill("0.1");
  await expect(page.getByTestId("save-status")).toHaveText("자동 저장 보류");
  await page.waitForTimeout(1000);
  expect(writes).toBe(0);
  await page.getByLabel("종료 1", { exact: true }).fill("2.5");
  await expect(page.getByTestId("save-status")).toHaveText("자동 저장됨");
  expect(writes).toBeGreaterThan(0);
});

test("failed auto save can be retried without losing the draft", async ({
  page,
}) => {
  await open(page);
  let fail = true;
  await page.route("**/api/projects/*", async (route) => {
    if (route.request().method() === "PUT" && fail) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "저장 연결 실패" }),
      });
    } else await route.continue();
  });
  await page.getByLabel("곡 이름", { exact: true }).fill("재시도할 편집");
  await expect(page.getByTestId("save-status")).toHaveText("자동 저장 실패");
  await expect(page.getByLabel("곡 이름", { exact: true })).toHaveValue(
    "재시도할 편집",
  );
  fail = false;
  await page.getByRole("button", { name: "다시 저장", exact: true }).click();
  await expect(page.getByTestId("save-status")).toHaveText("자동 저장됨");
  await page.reload();
  await page
    .getByRole("button", { name: "재시도할 편집", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "플레이어 편집", exact: true })
    .click();
  await expect(page.getByLabel("곡 이름", { exact: true })).toHaveValue(
    "재시도할 편집",
  );
});

test("opening another audio immediately flushes the current edit", async ({
  page,
}) => {
  await open(page);
  const title = `전환 직전 편집 ${Date.now()}`;
  await page.getByLabel("곡 이름", { exact: true }).fill(title);
  await page
    .getByTestId("audio-input")
    .setInputFiles(path.resolve(".local-data/fixtures/짧은 샘플.mp3"));
  await expect(page.getByLabel("곡 이름", { exact: true })).toHaveValue(
    "짧은 샘플",
  );
  await page.getByRole("button", { name: "파일", exact: true }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  await expect(page.getByLabel("곡 이름", { exact: true })).toHaveValue(title);
});
