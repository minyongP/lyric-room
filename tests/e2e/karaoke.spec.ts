import { test, expect } from "@playwright/test";
import path from "node:path";
import { newProject } from "../../src/shared/project";
import { applyTemplate } from "../../src/shared/templates";
import { randomUUID } from "node:crypto";
test("karaoke selection loads matching MP3 prompt and saves template", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("radio", { name: /노래방/ }).check();
  await page
    .getByTestId("audio-input")
    .setInputFiles(path.resolve(".local-data/fixtures/짧은 샘플.mp3"));
  await expect(page.getByLabel("노래방 강조 색상")).toBeVisible();
  await page
    .getByRole("button", { name: "AI 요청 가이드", exact: true })
    .click();
  const prompt = await page.getByLabel("AI에게 보낼 요청문").inputValue();
  expect(prompt).toContain("노래방 템플릿");
  expect(prompt).toContain("첨부한 MP3");
  expect(prompt).toContain("3.00");
  expect(prompt).toContain("words, syllables");
  expect(prompt).not.toContain("{{mode}}");
});
test("karaoke fill advances, seek repeats and blank intro stays blank", async ({
  page,
}) => {
  const p = applyTemplate(newProject(randomUUID()), "karaoke");
  p.duration = 20;
  p.lyrics = [
    { start: 2, end: 8, original: "음악을 따라 함께 불러요" },
    { start: 8, end: 12, original: "다음 가사가 여기에 보여요" },
    { start: 18, end: 20, original: "마지막 구절" },
  ];
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/render.html");
  const result = await page.evaluate(async (p) => {
    const b = (window as any).renderBridge;
    await b.prepare(p, { fps: 30, bands: 32, frames: [] });
    const ctx = document.querySelector("canvas")!.getContext("2d")!;
    const count = () => {
      const d = ctx.getImageData(100, 450, 1720, 410).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4)
        if (d[i] > 200 && d[i + 1] > 150 && d[i + 2] < 130) n++;
      return n;
    };
    await b.render(2);
    const start = count();
    await b.render(5);
    const half = count();
    const middle = await b.render(5);
    await b.render(7.9);
    const end = count();
    const back = await b.render(5);
    const orig = ctx.fillText.bind(ctx);
    let text: string[] = [];
    ctx.fillText = (s, ...args) => {
      text.push(s);
      orig(s, ...args);
    };
    await b.render(0);
    const intro = [...text];
    text = [];
    await b.render(14);
    const gap = [...text];
    text = [];
    await b.render(5);
    const active = [...text];
    return { start, half, end, same: middle === back, intro, gap, active };
  }, p);
  expect(result.start).toBe(0);
  expect(result.half).toBeGreaterThan(100);
  expect(result.end).toBeGreaterThan(result.half);
  expect(result.same).toBe(true);
  expect(result.intro).not.toContain(p.lyrics[0].original);
  expect(result.gap).toContain("간주 중");
  expect(result.active).toContain(p.lyrics[1].original);
  expect(result.active).not.toContain(p.lyrics[2].original);
  await page.screenshot({
    path: ".local-data/verification/karaoke-template.png",
  });
});
