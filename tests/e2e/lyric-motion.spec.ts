import { test, expect } from "@playwright/test";
import { newProject } from "../../src/shared/project";
import { randomUUID } from "node:crypto";
test("shared renderer scrolls upward continuously and fills instrumental gaps", async ({
  page,
}) => {
  const p = newProject(randomUUID());
  p.duration = 12;
  p.lyrics = [
    { start: 0, end: 2, original: "첫 구절" },
    { start: 2, end: 4, original: "다가오는 구절" },
    { start: 9, end: 11, original: "다시 노래해요" },
  ];
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/render.html");
  const result = await page.evaluate(async (p) => {
    const bridge = (window as any).renderBridge;
    await bridge.prepare(p, { fps: 30, bands: 32, frames: [] });
    const proto = CanvasRenderingContext2D.prototype,
      original = proto.fillText;
    let calls: { text: string; y: number }[] = [];
    proto.fillText = function (text, x, y, ...rest) {
      const matrix = this.getTransform();
      calls.push({ text, y: matrix.f + y * matrix.d });
      return original.call(this, text, x, y, ...rest);
    };
    try {
      const ys = [];
      for (const t of [1.999, 2, 2.2, 2.6]) {
        calls = [];
        await bridge.render(t);
        ys.push(calls.find((c) => c.text === "다가오는 구절")!.y);
      }
      calls = [];
      const gap = await bridge.render(5);
      const interlude = calls.some((c) => c.text === "간주 중");
      await bridge.render(10);
      const same = gap === (await bridge.render(5));
      return { ys, interlude, same };
    } finally {
      proto.fillText = original;
    }
  }, p);
  expect(Math.abs(result.ys[0] - result.ys[1])).toBeLessThan(1);
  expect(result.ys[2]).toBeLessThan(result.ys[1]);
  expect(result.ys[3]).toBeLessThan(result.ys[2]);
  expect(result.interlude).toBe(true);
  expect(result.same).toBe(true);
  await page.screenshot({ path: ".local-data/verification/interlude.png" });
});
