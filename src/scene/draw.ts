import { sceneTemplates } from "./templates";
import { round, image, fontFamily } from "./primitives";
export { playerForeground } from "./primitives";
import type { Project } from "../shared/project";
import { lyricMotion } from "./lyric-motion";
import { type Spectrum } from "../audio/spectrum";
import { layoutCue } from "./layout";
import type { SceneMedia } from "./media";
export const W = 1920,
  H = 1080;
function cueLayout(
  ctx: CanvasRenderingContext2D,
  p: Project,
  index: number,
  active: boolean,
) {
  const s = p.style,
    raw = p.lyrics[index];
  const cue = {
    ...raw,
    original: s.showOriginal ? raw.original : "",
    pronunciation: s.showPronunciation ? raw.pronunciation : undefined,
    translation: s.showTranslation ? raw.translation : undefined,
  };
  return layoutCue(
    cue,
    s.fontSize * (active ? 1 : 0.65),
    (text, font) => {
      ctx.font = `${active ? "700" : "400"} ${font}px ${fontFamily(p)}`;
      return ctx.measureText(text).width;
    },
    s.lyricsBox.w - 80,
    s.lyricsBox.h * (active ? 0.4 : 0.25),
    s.lineGap,
  );
}
/** Run once per export snapshot, including cues outside the current viewport. */
export function findOverflowCues(ctx: CanvasRenderingContext2D, p: Project) {
  if (!p.style.showLyrics) return [];
  return p.lyrics.flatMap((_, index) =>
    cueLayout(ctx, p, index, true).overflow ||
    cueLayout(ctx, p, index, false).overflow
      ? [index]
      : [],
  );
}
export function drawScene(
  ctx: CanvasRenderingContext2D,
  p: Project,
  t: number,
  spectrum: Spectrum,
  media: SceneMedia,
) {
  const renderer = sceneTemplates[p.templateId ?? "classic"];
  const s = p.style,
    overflowCueIndices: number[] = [];
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.fillStyle = "#262830";
  ctx.fillRect(0, 0, W, H);
  if (media.background) {
    ctx.filter = `blur(${s.backgroundBlur}px) brightness(${s.backgroundBrightness})`;
    image(
      ctx,
      media.background,
      {
        x: -s.backgroundBlur * 2,
        y: -s.backgroundBlur * 2,
        w: W + s.backgroundBlur * 4,
        h: H + s.backgroundBlur * 4,
      },
      s.backgroundFit,
      s.backgroundScale,
      s.backgroundX,
      s.backgroundY,
    );
  } else {
    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, "#89909b");
    gradient.addColorStop(0.55, "#555762");
    gradient.addColorStop(1, "#292b32");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(0,0,0,${1 - Math.min(1, s.backgroundBrightness)})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
  renderer.drawUnderlay?.(ctx, p);
  const family = fontFamily(p);
  if (s.showLyrics) {
    const b = s.lyricsBox;
    ctx.save();
    round(ctx, b, s.panelRadius);
    ctx.fillStyle = s.panelColor;
    ctx.globalAlpha = s.panelOpacity;
    if (renderer.lyricsPanel) ctx.fill();
    ctx.globalAlpha = 1;
    ctx.clip();
    const rows = lyricMotion(p.lyrics, p.duration, t);
    for (const row of rows) {
      if (row.opacity <= 0) continue;
      const y =
        b.y +
        b.h *
          ((renderer.lyricsAnchor ?? 0.51) +
            row.offset * (renderer.lyricsStep ?? 0.315));
      ctx.save();
      ctx.globalAlpha =
        row.opacity *
        (renderer.hidePrevious ? Math.max(0, Math.min(1, 1 + row.offset)) : 1);
      ctx.fillStyle = s.textColor;
      if (row.label) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `400 ${s.fontSize * 0.66 * row.scale}px ${family}`;
        ctx.fillText(row.label, b.x + b.w / 2, y - 12 * row.scale);
        for (let dot = 0; dot < 3; dot++) {
          const pulse =
            0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 3.8 - dot * 0.8));
          ctx.globalAlpha = row.opacity * pulse;
          ctx.beginPath();
          ctx.arc(
            b.x + b.w / 2 + (dot - 1) * 20 * row.scale,
            y + 28 * row.scale,
            3.5 * row.scale,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      } else if (row.cue !== undefined) {
        const layout = cueLayout(ctx, p, row.cue, true);
        if (layout.overflow) overflowCueIndices.push(row.cue);
        const x =
          s.align === "center"
            ? b.x + b.w / 2
            : s.align === "left"
              ? b.x + 40
              : b.x + b.w - 40;
        ctx.translate(x, y);
        ctx.scale(row.scale, row.scale);
        let cy = -layout.height / 2;
        ctx.textBaseline = "top";
        ctx.textAlign = s.align;
        for (const line of layout.lines) {
          ctx.font = `700 ${line.size}px ${family}`;
          ctx.fillText(line.text, 0, cy);
          cy += line.size * 1.3 + s.lineGap;
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }
  renderer.drawForeground(ctx, p, t, spectrum, media);
  return { overflowCueIndices };
}
