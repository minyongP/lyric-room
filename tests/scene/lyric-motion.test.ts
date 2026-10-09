import { test, expect } from "vitest";
import { lyricMotion } from "../../src/scene/lyric-motion";
const cues = [
  { start: 2, end: 4, original: "첫 구절" },
  { start: 4, end: 6, original: "다음 구절" },
  { start: 10, end: 12, original: "마지막" },
];
test("cue transition starts at the old position and moves smoothly upward", () => {
  const before = lyricMotion(cues, 14, 3.999),
    start = lyricMotion(cues, 14, 4),
    middle = lyricMotion(cues, 14, 4.2),
    settled = lyricMotion(cues, 14, 4.6);
  const y = (frame: ReturnType<typeof lyricMotion>, cue: number) =>
    frame.find((row) => row.cue === cue)!.offset;
  expect(Math.abs(y(before, 1) - y(start, 1))).toBeLessThan(0.01);
  expect(y(middle, 1)).toBeLessThan(y(start, 1));
  expect(y(middle, 1)).toBeGreaterThan(y(settled, 1));
  expect(y(settled, 1)).toBe(0);
});
test("long gaps have an interlude row but short breathing gaps do not flash a label", () => {
  expect(lyricMotion(cues, 14, 8).find((r) => r.offset === 0)?.label).toBe(
    "간주 중",
  );
  expect(lyricMotion(cues, 14, 1).find((r) => r.offset === 0)?.label).toBe(
    "전주 중",
  );
  expect(lyricMotion(cues, 14, 13).find((r) => r.offset === 0)?.label).toBe(
    "후주 중",
  );
  const short = [
    { start: 0, end: 1, original: "a" },
    { start: 1.2, end: 2, original: "b" },
  ];
  expect(lyricMotion(short, 2, 1.1).some((r) => r.label)).toBe(false);
});
test("seeking is deterministic and empty lyrics show a listening state", () => {
  const initial = lyricMotion(cues, 14, 4.2);
  lyricMotion(cues, 14, 11);
  expect(lyricMotion(cues, 14, 4.2)).toEqual(initial);
  expect(lyricMotion([], 10, 3)[0].label).toBe("음악 감상 중");
});
