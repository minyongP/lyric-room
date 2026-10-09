import { drawVisualizer } from "../visualizer";
import { round, image, fontFamily, playerForeground } from "../primitives";
import { formatTime } from "../../shared/project";
import type { SceneTemplate } from "./types";
export const classic: SceneTemplate = {
  lyricsPanel: true,
  drawForeground(ctx, p, t, spectrum, media) {
    const s = p.style,
      family = fontFamily(p);
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
  },
};
