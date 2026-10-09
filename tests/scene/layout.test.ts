import { test, expect } from "vitest";
import { layoutCue, clampBox } from "../../src/scene/layout";
test("wraps text without dropping characters and reports excessive content", () => {
  const cue = { start: 0, end: 1, original: "가나다라".repeat(3000) };
  expect(layoutCue(cue, 48, (t, s) => t.length * s, 1600, 300).overflow).toBe(
    true,
  );
  const fit = layoutCue(
    { ...cue, original: "가나다라" },
    48,
    (t, s) => t.length * s,
    1600,
    300,
  );
  expect(fit.overflow).toBe(false);
  expect(fit.lines.map((x) => x.text).join("")).toBe("가나다라");
});
test("drag bounds keep visible elements inside frame", () =>
  expect(clampBox({ x: -20, y: 1050, w: 500, h: 200 })).toEqual({
    x: 0,
    y: 880,
    w: 500,
    h: 200,
  }));
