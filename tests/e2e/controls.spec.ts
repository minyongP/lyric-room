import { test, expect } from "@playwright/test";
import path from "node:path";
test("preview shows working transport above the progress bar in edit and play modes", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("audio-input")
    .setInputFiles(path.resolve(".local-data/fixtures/짧은 샘플.mp3"));
  const controls = page.getByRole("group", { name: "화면 내 재생 조작" });
  await expect(controls).toBeVisible();
  await expect(
    controls.getByRole("button", { name: "이전 구절" }),
  ).toBeVisible();
  await expect(
    controls.getByRole("button", { name: "다음 구절" }),
  ).toBeVisible();
  await controls.getByRole("button", { name: "재생", exact: true }).click();
  await expect
    .poll(async () => Number(await page.getByLabel("재생 위치").inputValue()))
    .toBeGreaterThan(0.1);
  await controls.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.getByRole("button", { name: "플레이 화면", exact: true }).click();
  await expect(
    controls.getByRole("button", { name: "재생", exact: true }),
  ).toBeVisible();
});
