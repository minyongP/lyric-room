import { formatTime } from "../../shared/project";
import { fontFamily, image, round } from "../primitives";
import { visualizerFrame } from "../visualizer";
import type { SceneTemplate } from "./types";
/** Pure timestamp-based rotation: seeking and MP4 export always agree. Zero pauses rotation. */
export function discAngle(time: number, seconds: number) {
  return seconds > 0
    ? ((Math.max(0, time) % seconds) / seconds) * Math.PI * 2
    : 0;
}
export const vinyl: SceneTemplate = {
  lyricsPanel: false,
  lyricsAnchor: 0.28,
  lyricsStep: 0.48,
  hidePrevious: true,
  drawUnderlay(ctx, p) {
    const s = p.style,
      b = s.visualizerBox;
    ctx.save();
    round(
      ctx,
      { x: b.x, y: b.y, w: b.w, h: Math.max(40, 1060 - b.y) },
      s.panelRadius,
    );
    ctx.fillStyle = s.panelColor;
    ctx.globalAlpha = s.panelOpacity;
    ctx.fill();
    ctx.restore();
  },
  drawForeground(ctx, p, time, spectrum, media) {
    const s = p.style,
      b = s.visualizerBox,
      center = b.x + b.w / 2;
    const radius = Math.min(
      (s.discSize ?? 370) / 2,
      b.w * 0.3,
      b.y - 12,
      1068 - b.y,
    );
    const family = fontFamily(p),
      title = s.playerBox;
    ctx.save();
    // The rail remains when the spectrum is hidden; it is part of the scene frame.
    const frame = { x: b.x, y: b.y, w: b.w, h: Math.max(40, 1060 - b.y) };
    round(ctx, frame, s.panelRadius);
    ctx.globalAlpha = s.visualizerOpacity;
    ctx.strokeStyle = s.visualizerColor;
    ctx.lineWidth = 8;
    ctx.stroke();
    if (s.showVisualizer) {
      const { levels } = visualizerFrame(spectrum, time, s.visualizerGain);
      const gap = s.showCover ? Math.max(0, radius) + 12 : 18;
      const left = b.x + Math.min(s.panelRadius, b.w / 8),
        right = b.x + b.w - Math.min(s.panelRadius, b.w / 8);
      ctx.fillStyle = s.visualizerColor;
      ctx.shadowColor = s.visualizerColor;
      ctx.shadowBlur = s.visualizerGlow * 18;
      for (const [start, end, reverse] of [
        [left, center - gap, 0],
        [center + gap, right, 1],
      ]) {
        if (end <= start) continue;
        const values = reverse ? [...levels].reverse() : levels;
        if (s.visualizerType === "bars") {
          const step = (end - start) / values.length;
          values.forEach((v, i) => {
            ctx.beginPath();
            ctx.roundRect(
              start + i * step,
              b.y,
              step * 0.65,
              Math.max(0.5, v * b.h),
              Math.min(step * 0.3, (v * b.h) / 2),
            );
            ctx.fill();
          });
        } else {
          ctx.beginPath();
          ctx.moveTo(start, b.y);
          let px = start,
            py = b.y;
          values.forEach((v, i) => {
            const x = start + (i * (end - start)) / (values.length - 1);
            // Ease both ends back into the horizontal rail.
            const taper = Math.sin((Math.PI * i) / (values.length - 1)) ** 0.5;
            const y = b.y + v * b.h * taper,
              mid = (px + x) / 2;
            ctx.bezierCurveTo(mid, py, mid, y, x, y);
            px = x;
            py = y;
          });
          ctx.lineTo(end, b.y);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    ctx.restore();
    ctx.save();
    round(ctx, title, s.playerRadius);
    ctx.fillStyle = s.playerColor;
    ctx.globalAlpha = s.playerOpacity;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = s.textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `400 ${s.infoSize}px ${family}`;
    const heading = [s.showArtist ? p.artist : "", s.showTitle ? p.title : ""]
      .filter(Boolean)
      .join("  /  ");
    ctx.fillText(
      heading,
      title.x + title.w / 2,
      title.y + title.h / 2,
      Math.max(1, title.w - 60),
    );
    if (s.showCover && radius > 0) {
      ctx.save();
      ctx.translate(center, b.y);
      ctx.rotate(discAngle(time, s.rotationSeconds ?? 24));
      ctx.shadowColor = "#00000055";
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 6;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = s.visualizerColor;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1, radius - 12), 0, Math.PI * 2);
      ctx.clip();
      const disc = { x: -radius, y: -radius, w: radius * 2, h: radius * 2 };
      if (media.cover) image(ctx, media.cover, disc);
      else {
        const gradient = ctx.createLinearGradient(
          -radius,
          -radius,
          radius,
          radius,
        );
        gradient.addColorStop(0, "#b9b4af");
        gradient.addColorStop(0.45, "#555965");
        gradient.addColorStop(1, "#24262d");
        ctx.fillStyle = gradient;
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
        ctx.strokeStyle = "#ffffff22";
        ctx.lineWidth = 2;
        for (let r = 32; r < radius - 15; r += 16) {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = "#ded9d1";
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (s.showProgress) {
      ctx.textAlign = "right";
      ctx.font = `400 26px ${family}`;
      ctx.fillText(
        `${formatTime(time)}  /  ${formatTime(p.duration)}`,
        b.x + b.w - 34,
        1020,
        Math.max(1, b.w - 68),
      );
      ctx.globalAlpha = 0.25;
      ctx.fillRect(b.x + 34, 1040, Math.max(0, b.w - 68), 2);
      ctx.globalAlpha = 1;
      ctx.fillRect(
        b.x + 34,
        1040,
        Math.max(0, b.w - 68) * Math.min(1, time / (p.duration || 1)),
        2,
      );
    }
    ctx.restore();
  },
};
