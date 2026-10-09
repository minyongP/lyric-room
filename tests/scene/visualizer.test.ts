import { test, expect } from "vitest";
import { visualizerFrame } from "../../src/scene/visualizer";
import { spectrumAt, type Spectrum } from "../../src/audio/spectrum";
const data = (frames: number[][]): Spectrum => ({ fps: 30, bands: 32, frames });
test("interpolates between analysis frames instead of stepping", () => {
  expect(
    spectrumAt(data([Array(32).fill(0), Array(32).fill(1)]), 1 / 60)[0],
  ).toBeCloseTo(0.5);
});
test("silent visualizer stays silent and high gain stays within its box", () => {
  const silent = visualizerFrame(data([Array(32).fill(0)]), 0, 3);
  expect(silent.levels).toHaveLength(64);
  expect(silent.levels.every((x) => x === 0)).toBe(true);
  expect(
    visualizerFrame(data([Array(32).fill(0.9)]), 0, 3).levels.every(
      (x) => x <= 1,
    ),
  ).toBe(true);
});
test("peak indicators decay and are identical after seeking backwards", () => {
  const input = data([
    Array(32).fill(1),
    ...Array.from({ length: 30 }, () => Array(32).fill(0)),
  ]);
  const first = visualizerFrame(input, 0.1, 1);
  expect(first.peaks[0]).toBeGreaterThan(first.levels[0]);
  expect(visualizerFrame(input, 0.4, 1).peaks[0]).toBeLessThan(first.peaks[0]);
  visualizerFrame(input, 0.8, 1);
  expect(visualizerFrame(input, 0.1, 1)).toEqual(first);
});
