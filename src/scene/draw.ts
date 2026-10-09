import { drawVisualizer } from "./visualizer";
import type { Box, Project } from "../shared/project";
import { formatTime } from "../shared/project";
import { cueWindow } from "../shared/lyrics";
import { type Spectrum } from "../audio/spectrum";
import { layoutCue } from "./layout";
import type { SceneMedia } from "./media";
export const W = 1920,
  H = 1080;
export function playerForeground(color: string) {
  const luminance =
    parseInt(color.slice(1, 3), 16) * 0.2126 +
    parseInt(color.slice(3, 5), 16) * 0.7152 +
    parseInt(color.slice(5, 7), 16) * 0.0722;
  return luminance > 145 ? "#222226" : "#ffffff";
}
function round(ctx: CanvasRenderingContext2D, b: Box, r: number) {
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, Math.min(r, b.h / 2, b.w / 2));
}
function image(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLVideoElement,
  b: Box,
  fit = "cover",
  scale = 1,
  ox = 0,
  oy = 0,
) {
  const iw =
      img instanceof HTMLVideoElement ? img.videoWidth : img.naturalWidth,
    ih = img instanceof HTMLVideoElement ? img.videoHeight : img.naturalHeight;
  if (!iw || !ih) return;
  const factor =
    (fit === "cover"
      ? Math.max(b.w / iw, b.h / ih)
      : Math.min(b.w / iw, b.h / ih)) * scale;
  ctx.drawImage(
    img,
    b.x + (b.w - iw * factor) / 2 + (ox * b.w) / 2,
    b.y + (b.h - ih * factor) / 2 + (oy * b.h) / 2,
    iw * factor,
    ih * factor,
  );
}
function fontFamily(p: Project) {
  return p.style.fontFamily === "serif"
    ? 'Georgia,"Noto Sans KR","Noto Sans JP",serif'
    : '"Noto Sans KR","Noto Sans JP",sans-serif';
}
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
  const family = fontFamily(p);
  if (s.showLyrics) {
    const b = s.lyricsBox;
    ctx.save();
    round(ctx, b, s.panelRadius);
    ctx.fillStyle = s.panelColor;
    ctx.globalAlpha = s.panelOpacity;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.clip();
    const window = cueWindow(p.lyrics, t);
    const positions = [
      { i: window.previous, y: b.y + b.h * 0.2, active: false },
      { i: window.current, y: b.y + b.h * 0.51, active: true },
      { i: window.next, y: b.y + b.h * 0.83, active: false },
    ];
    for (const { i, y, active } of positions) {
      if (i === null) continue;
      const layout = cueLayout(ctx, p, i, active);
      if (layout.overflow) overflowCueIndices.push(i);
      let cy = y - layout.height / 2;
      ctx.fillStyle = s.textColor;
      ctx.globalAlpha = active ? 1 : 0.42;
      ctx.textBaseline = "top";
      ctx.textAlign = s.align;
      const x =
        s.align === "center"
          ? b.x + b.w / 2
          : s.align === "left"
            ? b.x + 40
            : b.x + b.w - 40;
      for (const l of layout.lines) {
        ctx.font = `${active ? "700" : "400"} ${l.size}px ${family}`;
        ctx.fillText(l.text, x, cy);
        cy += l.size * 1.3 + s.lineGap;
      }
    }
    ctx.restore();
  }
  const b = s.playerBox;
  ctx.save();
  round(ctx, b, s.playerRadius);
  ctx.fillStyle = s.playerColor;
  ctx.globalAlpha = s.playerOpacity;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.clip();
  let ix = b.x + 30;
  if (s.showCover) {
    const cover = {
      x: b.x,
      y: b.y,
      w: Math.min(s.coverSize, b.w * 0.3),
      h: b.h,
    };
    round(ctx, cover, s.coverRadius);
    ctx.save();
    ctx.clip();
    if (media.cover) image(ctx, media.cover, cover);
    else {
      const g = ctx.createLinearGradient(
        cover.x,
        cover.y,
        cover.x + cover.w,
        cover.y + cover.h,
      );
      g.addColorStop(0, "#9396a0");
      g.addColorStop(0.5, "#ddd4c9");
      g.addColorStop(1, "#67636a");
      ctx.fillStyle = g;
      ctx.fillRect(cover.x, cover.y, cover.w, cover.h);
    }
    ctx.restore();
    ix = cover.x + cover.w + 30;
  }
  ctx.fillStyle = playerForeground(s.playerColor);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  if (s.showTitle) {
    ctx.font = `700 ${s.infoSize}px ${family}`;
    ctx.fillText(
      p.title,
      ix,
      b.y + b.h * 0.4,
      Math.max(50, b.w * 0.34 - (ix - b.x)),
    );
  }
  if (s.showArtist) {
    ctx.font = `400 ${s.infoSize * 0.65}px ${family}`;
    ctx.globalAlpha = 0.65;
    ctx.fillText(
      p.artist,
      ix,
      b.y + b.h * 0.67,
      Math.max(50, b.w * 0.34 - (ix - b.x)),
    );
    ctx.globalAlpha = 1;
  }
  if (s.showProgress) {
    const x = b.x + b.w * 0.42,
      w = b.w * 0.5,
      y = b.y + b.h * 0.72;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(x, y, w, 3);
    ctx.globalAlpha = 1;
    ctx.fillRect(x, y, w * Math.min(1, t / (p.duration || 1)), 3);
    ctx.font = `400 20px ${family}`;
    ctx.fillText(formatTime(t), x - 70, y);
    ctx.fillText(formatTime(p.duration), x + w + 15, y);
  }
  ctx.restore();
  if (s.showVisualizer) drawVisualizer(ctx, s, spectrum, t);
  return { overflowCueIndices };
}
