import type { LyricCue } from "../shared/lyrics";
type Entry = { start: number; end: number; cue?: number; label?: string };
const cache = new WeakMap<LyricCue[], { duration: number; entries: Entry[] }>();
function timeline(cues: LyricCue[], duration: number) {
  const cached = cache.get(cues);
  if (cached?.duration === duration) return cached.entries;
  const entries: Entry[] = [];
  if (!cues.length) entries.push({ start: 0, end: duration });
  else {
    if (cues[0].start > 0)
      entries.push({
        start: 0,
        end: cues[0].start,
        label: undefined,
      });
    cues.forEach((cue, i) => {
      entries.push({ start: cue.start, end: cue.end, cue: i });
      const end = cues[i + 1]?.start ?? duration;
      if (end > cue.end)
        entries.push({
          start: cue.end,
          end,
          label:
            i < cues.length - 1 && end - cue.end >= 5 ? "간주 중" : undefined,
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
      entry.cue === undefined && !entry.label ? 0.16 : 0.55,
      ((entries[index + 1]?.start ?? duration) - entry.start) *
        (entry.cue === undefined && !entry.label ? 0.5 : 0.8),
    ),
  );
  const u = Math.max(0, Math.min(1, (time - entry.start) / transition));
  const eased = index === 0 ? 1 : u * u * (3 - 2 * u);
  const inSong =
    !!cues.length && time >= cues[0].start && time < cues[cues.length - 1].end;
  // Blank intervals occupy the center only while active; they must not hide
  // the previous/next lyric previews during a sung line.
  function positions(at: number) {
    const rows = new Map<
      number,
      { offset: number; emphasis: number; opacity: number }
    >();
    const current = entries[at];
    let previous = at - 1,
      next = at + 1;
    while (previous >= 0 && entries[previous].cue === undefined) previous--;
    while (next < entries.length && entries[next].cue === undefined) next++;
    if (previous >= 0)
      rows.set(previous, { offset: -1, emphasis: 0, opacity: 0.38 });
    rows.set(at, {
      offset: 0,
      emphasis: 1,
      opacity: current.cue !== undefined || current.label ? 1 : 0,
    });
    if (next < entries.length)
      rows.set(next, { offset: 1, emphasis: 0, opacity: 0.38 });
    return rows;
  }
  const from = positions(Math.max(0, index - 1)),
    to = positions(index);
  return [...new Set([...from.keys(), ...to.keys()])].map((key) => {
    const destination = to.get(key),
      origin = from.get(key);
    const start = origin ?? {
      offset: destination!.offset + 1,
      emphasis: 0,
      opacity: 0,
    };
    const end = destination ?? {
      offset: start.offset - 1,
      emphasis: 0,
      opacity: 0,
    };
    const mix = (a: number, b: number) => a + (b - a) * eased;
    const emphasis = mix(start.emphasis, end.emphasis),
      row = entries[key];
    return {
      ...row,
      cue: row.cue,
      label: inSong && key === index ? row.label : undefined,
      offset: mix(start.offset, end.offset),
      emphasis,
      opacity: inSong ? mix(start.opacity, end.opacity) : 0,
      scale: 0.65 + 0.35 * emphasis,
    };
  });
}
