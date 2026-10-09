import type { Box } from "../shared/project";
import type { LyricCue } from "../shared/lyrics";
export function clampBox(b: Box): Box {
  const w = Math.min(1920, Math.max(120, b.w)),
    h = Math.min(1080, Math.max(40, b.h));
  return {
    x: Math.max(0, Math.min(1920 - w, b.x)),
    y: Math.max(0, Math.min(1080 - h, b.y)),
    w,
    h,
  };
}
export function layoutCue(
  cue: LyricCue,
  fontSize: number,
  measure: (text: string, size: number) => number,
  width = 1600,
  height = 300,
  gap = 10,
) {
  let size = fontSize;
  for (;;) {
    const lines: { text: string; size: number }[] = [];
    for (const [i, text] of [
      cue.original,
      cue.pronunciation,
      cue.translation,
    ].entries()) {
      if (!text) continue;
      const s = size * (i === 1 ? 0.78 : 1);
      let line = "";
      for (const char of Array.from(text)) {
        if (char === "\n" || (line && measure(line + char, s) > width)) {
          lines.push({ text: line, size: s });
          line = char === "\n" ? "" : char;
        } else line += char;
      }
      if (line) lines.push({ text: line, size: s });
    }
    const total = lines.reduce((n, l) => n + l.size * 1.3 + gap, 0);
    if (total <= height || size <= 24)
      return { lines, overflow: total > height, height: total };
    size = Math.max(24, size - 2);
  }
}
