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
test("only internal gaps of at least five seconds show an interlude", () => {
  const long = [
    { start: 8, end: 10, original: "a" },
    { start: 15, end: 17, original: "b" },
  ];
  expect(lyricMotion(long, 25, 12).find((r) => r.offset === 0)?.label).toBe(
    "간주 중",
  );
  for (const time of [0, 5, 18, 24])
    expect(lyricMotion(long, 25, time).every((r) => r.opacity === 0)).toBe(
      true,
    );
  expect(lyricMotion(cues, 14, 8).find((r) => r.offset === 0)).toMatchObject({
    cue: undefined,
    label: undefined,
  });
  const short = [
    { start: 0, end: 1, original: "a" },
    { start: 1.2, end: 2, original: "b" },
  ];
  const blank = lyricMotion(short, 2, 1.15).find((r) => r.offset === 0);
  expect(blank).toMatchObject({ cue: undefined, label: undefined });
  expect(lyricMotion(long, 25, 9).some((r) => r.label)).toBe(false);
  expect(lyricMotion(long, 25, 15.7).some((r) => r.label)).toBe(false);
});
test("seeking is deterministic and empty lyrics stay blank", () => {
  const initial = lyricMotion(cues, 14, 4.2);
  lyricMotion(cues, 14, 11);
  expect(lyricMotion(cues, 14, 4.2)).toEqual(initial);
  expect(lyricMotion([], 10, 3).every((r) => !r.label && r.opacity === 0)).toBe(
    true,
  );
});

test("short gaps do not replace previous and next lyric previews while singing", () => {
  const lyrics = [
    { start: 0, end: 1, original: "a" },
    { start: 1.2, end: 3, original: "b" },
    { start: 3.2, end: 5, original: "c" },
  ];
  const rows = lyricMotion(lyrics, 5, 2);
  expect(rows.find((r) => r.cue === 0)).toMatchObject({
    offset: -1,
    opacity: 0.38,
  });
  expect(rows.find((r) => r.cue === 2)).toMatchObject({
    offset: 1,
    opacity: 0.38,
  });
});
