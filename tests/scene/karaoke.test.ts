import { test, expect } from "vitest";
import { newProject } from "../../src/shared/project";
import {
  karaokeRows,
  karaokeProgress,
} from "../../src/scene/templates/karaoke";
const p = newProject("d22abfc2-8999-4c6a-94f1-83c720389cc8");
p.duration = 20;
p.lyrics = [
  { start: 2, end: 4, original: "첫 구절" },
  { start: 4.3, end: 8, original: "다음 구절" },
  { start: 13, end: 16, original: "마지막 구절" },
];
test("keeps completed and upcoming lyrics across short gaps until next start", () => {
  for (const t of [3.99, 4, 4.15, 4.299])
    expect(karaokeRows(p, t).map((r) => r.cue)).toEqual([0, 1]);
  expect(karaokeRows(p, 4.3).map((r) => r.cue)).toEqual([1, 2]);
  expect(karaokeProgress(2, 4, 4.15)).toBe(1);
});
test("preserves intro/outro blanks and five-second instrumental gaps", () => {
  expect(karaokeRows(p, 0)).toEqual([]);
  expect(karaokeRows(p, 17)).toEqual([]);
  expect(karaokeRows(p, 9).some((r) => r.label === "간주 중")).toBe(true);
  expect(karaokeRows(p, 9).some((r) => r.cue !== undefined)).toBe(false);
  expect(karaokeRows({ ...p, lyrics: [] }, 5)).toEqual([]);
});
