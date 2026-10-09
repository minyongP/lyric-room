import { expect, test } from "vitest";
import { parseLyrics, cueWindow } from "../../src/shared/lyrics";
const cues = [
  { start: 1, end: 2, original: "가" },
  { start: 3, end: 4, original: "나" },
];
test("half-open boundaries and silent gaps survive seeking backwards", () => {
  expect(cueWindow(cues, 1)).toEqual({ previous: null, current: 0, next: 1 });
  expect(cueWindow(cues, 2)).toEqual({ previous: 0, current: null, next: 1 });
  expect(cueWindow(cues, 0)).toEqual({
    previous: null,
    current: null,
    next: 0,
  });
  expect(cueWindow(cues, 5)).toEqual({
    previous: 1,
    current: null,
    next: null,
  });
  expect(cueWindow(cues, 1).current).toBe(0);
});
test("validates version and optional fields, accepts no lyrics", () => {
  expect(parseLyrics({ lyrics: [] }, 5)).toEqual({ ok: true, lyrics: [] });
  expect(parseLyrics({ lyrics: cues }, 5).ok).toBe(true);
  expect(parseLyrics({ schemaVersion: 2, lyrics: [] }, 5).ok).toBe(false);
});
test.each([
  { start: -1 },
  { start: Infinity },
  { start: NaN },
  { end: 0 },
  { end: 9 },
  { original: " " },
  { translation: 12 },
])("rejects invalid cue %j", (patch) => {
  expect(parseLyrics({ lyrics: [{ ...cues[0], ...patch }] }, 5).ok).toBe(false);
});
test("rejects overlap and unsorted cues", () => {
  expect(parseLyrics({ lyrics: [...cues].reverse() }, 5).ok).toBe(false);
  expect(
    parseLyrics({ lyrics: [cues[0], { ...cues[1], start: 1.5 }] }, 5).ok,
  ).toBe(false);
});
