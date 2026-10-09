import { test, expect } from "@playwright/test";
import path from "node:path";
test("AI guide explains foreign lyrics and provides a full prompt and import handoff", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page
    .getByTestId("audio-input")
    .setInputFiles(path.resolve(".local-data/fixtures/짧은 샘플.mp3"));
  await page
    .getByRole("button", { name: "AI 요청 가이드", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "AI로 타임라인 가사 만들기",
  });
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: ".local-data/verification/ai-guide.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "AI 요청 가이드", exact: true })
    .click();
  for (const name of ["한국곡", "영어곡", "일본곡", "기타"]) {
    await dialog.getByRole("radio", { name, exact: true }).check();
    await expect(
      dialog.getByRole("radio", { name, exact: true }),
    ).toBeChecked();
    const text = await dialog.getByLabel("AI에게 보낼 요청문").inputValue();
    expect(text).toContain("제공한 원문 가사만");
    if (name === "한국곡") expect(text).toContain("발음과 번역 필드는 생략");
    if (name === "영어곡") expect(text).toContain("연음");
    if (name === "일본곡") expect(text).toContain("한자의 읽기");
    if (name === "기타") expect(text).toContain("언어를 먼저 확인");
  }
  await dialog.getByRole("radio", { name: "일본곡", exact: true }).check();
  const prompt = await dialog.getByLabel("AI에게 보낼 요청문").inputValue();
  expect(prompt).toContain("3.00");
  expect(prompt).toContain("일본어");
  expect(prompt).toContain("pronunciation");
  expect(prompt).toContain("추측");
  await dialog
    .getByRole("button", { name: "요청문 복사", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toHaveText(
    "요청문을 복사했습니다. MP3와 함께 AI에게 보내세요.",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    prompt,
  );
  await dialog.getByRole("button", { name: "JSON 가져오기로 이동" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "가사 JSON 가져오기" }),
  ).toBeVisible();
});
