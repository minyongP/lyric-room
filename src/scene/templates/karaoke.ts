import { classic } from "./classic";
import { lyricMotion } from "../lyric-motion";
import type { Project } from "../../shared/project";
import type { SceneTemplate } from "./types";
export function karaokeProgress(start: number, end: number, time: number) {
  return end > start
    ? Math.max(0, Math.min(1, (time - start) / (end - start)))
    : 0;
}
export function karaokeRows(
  p: Project,
  time: number,
): ReturnType<typeof lyricMotion> {
  const index = p.lyrics.findIndex((c) => time >= c.start && time < c.end);
  if (index < 0)
    return lyricMotion(p.lyrics, p.duration, time).filter((row) => !!row.label);
  return [index, index + 1]
    .filter((i) => i < p.lyrics.length)
    .map((cue, i) => ({
      cue,
      start: p.lyrics[cue].start,
      end: p.lyrics[cue].end,
      label: undefined,
      emphasis: i === 0 ? 1 : 0,
      offset: i,
      scale: i === 0 ? 1 : 0.75,
      opacity: i === 0 ? 1 : 0.65,
    }));
}
export const karaoke: SceneTemplate = {
  ...classic,
  karaoke: true,
  lyricsAnchor: 0.28,
  lyricsStep: 0.5,
};
