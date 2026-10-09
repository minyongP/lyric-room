import type { LyricCue } from "../shared/lyrics";
type Entry = { start: number; end: number; cue?: number; label?: string };
const cache = new WeakMap<LyricCue[], { duration: number; entries: Entry[] }>();
function timeline(cues: LyricCue[], duration: number) {
  const cached = cache.get(cues);
  if (cached?.duration === duration) return cached.entries;
  const entries: Entry[] = [];
  if (!cues.length)
    entries.push({ start: 0, end: duration, label: "음악 감상 중" });
  else {
    if (cues[0].start > 0)
      entries.push({
        start: 0,
        end: cues[0].start,
        label: cues[0].start >= 1.2 ? "전주 중" : undefined,
      });
    cues.forEach((cue, i) => {
      entries.push({ start: cue.start, end: cue.end, cue: i });
      const end = cues[i + 1]?.start ?? duration;
      if (end - cue.end >= 1.2)
        entries.push({
          start: cue.end,
          end,
          label: i === cues.length - 1 ? "후주 중" : "간주 중",
        });
    });
  }
  cache.set(cues, { duration, entries });
  return entries;
}
/** Timestamp-only animation: identical during playback, seeking and frame export. */
export function lyricMotion(cues: LyricCue[], duration: number, time: number) {
  const entries = timeline(cues, duration);
  let lo = 0,
    hi = entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (entries[mid].start <= time) lo = mid + 1;
    else hi = mid;
  }
  const index = Math.max(0, lo - 1),
    entry = entries[index];
  const transition = Math.max(
    0.001,
    Math.min(
      0.55,
      ((entries[index + 1]?.start ?? duration) - entry.start) * 0.8,
    ),
  );
  const u = Math.max(0, Math.min(1, (time - entry.start) / transition));
  const eased = u * u * (3 - 2 * u),
    focus = index === 0 ? 0 : index - 1 + eased;
  return entries
    .slice(Math.max(0, index - 2), Math.min(entries.length, index + 3))
    .map((row, j) => {
      const offset = Math.max(0, index - 2) + j - focus,
        distance = Math.abs(offset),
        emphasis = Math.max(0, 1 - distance);
      return {
        ...row,
        offset,
        emphasis,
        opacity:
          Math.max(0, Math.min(1, 2 - distance)) * (0.38 + 0.62 * emphasis),
        scale: 0.65 + 0.35 * emphasis,
      };
    });
}
