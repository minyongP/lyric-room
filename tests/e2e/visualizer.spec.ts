import { test, expect } from "@playwright/test";
import { newProject } from "../../src/shared/project";
import { analyzePcm } from "../../src/audio/spectrum";
import { randomUUID } from "node:crypto";
test("polished visualizer renders deterministically in both modes", async ({
  page,
}) => {
  const p = newProject(randomUUID());
  p.duration = 3;
  p.title = "시각 효과 미리보기";
  p.artist = "테스트용 합성 음원";
  p.lyrics = [
    {
      start: 0,
      end: 3,
      original: "음악의 흐름을 담다",
      translation: "실제 주파수에 반응하는 시각 효과",
    },
  ];
  p.style.visualizerBox = { x: 280, y: 978, w: 1360, h: 88 };
  const spectrum = analyzePcm(
    Float32Array.from({ length: 72000 }, (_, i) =>
      [110, 220, 440, 880, 1760, 3520, 7040].reduce(
        (sum, hz, j) =>
          sum +
          Math.sin((2 * Math.PI * hz * i) / 24000) *
            (0.035 / (j + 1)) *
            (0.6 + 0.4 * Math.sin((i / 24000) * (j + 1) * 4)),
        0,
      ),
    ),
    24000,
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/render.html");
  const result = await page.evaluate(
    async ({ p, spectrum }) => {
      const bridge = (window as any).renderBridge;
      await bridge.prepare(p, spectrum);
      const first = await bridge.render(0.5);
      await bridge.render(1.5);
      const back = await bridge.render(0.5);
      return { same: first === back };
    },
    { p, spectrum },
  );
  expect(result.same).toBe(true);
  await page.screenshot({
    path: ".local-data/verification/visualizer-bars.png",
  });
  p.style.visualizerType = "wave";
  await page.evaluate(
    async ({ p, spectrum }) => {
      await (window as any).renderBridge.prepare(p, spectrum);
      await (window as any).renderBridge.render(0.5);
    },
    { p, spectrum },
  );
  await page.screenshot({
    path: ".local-data/verification/visualizer-line.png",
  });
});
