import type { Box, Project } from "../shared/project";
export function playerForeground(color: string) {
  const luminance =
    parseInt(color.slice(1, 3), 16) * 0.2126 +
    parseInt(color.slice(3, 5), 16) * 0.7152 +
    parseInt(color.slice(5, 7), 16) * 0.0722;
  return luminance > 145 ? "#222226" : "#ffffff";
}
export function round(ctx: CanvasRenderingContext2D, b: Box, r: number) {
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, Math.min(r, b.h / 2, b.w / 2));
}
export function image(
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
export function fontFamily(p: Project) {
  return p.style.fontFamily === "serif"
    ? 'Georgia,"Noto Sans KR","Noto Sans JP",serif'
    : '"Noto Sans KR","Noto Sans JP",sans-serif';
}
