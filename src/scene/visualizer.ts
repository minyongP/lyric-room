import { spectrumAt, type Spectrum } from "../audio/spectrum";
import type { Style } from "../shared/project";
const clamp = (n: number) => Math.max(0, Math.min(1, n));
/** Resample measured bands for a denser display; this does not add frequency resolution. */
function resample(values: number[], count: number) {
  return Array.from({ length: count }, (_, i) => {
    const x = (i * (values.length - 1)) / (count - 1),
      a = Math.floor(x),
      f = x - a;
    return (
      (values[a] || 0) * (1 - f) +
      (values[Math.min(a + 1, values.length - 1)] || 0) * f
    );
  });
}
export function visualizerFrame(data: Spectrum, time: number, gain: number) {
  const current = spectrumAt(data, time),
    prior = spectrumAt(data, Math.max(0, time - 1 / data.fps)),
    older = spectrumAt(data, Math.max(0, time - 2 / data.fps));
  const smoothed = current.map(
    (v, i) => v * 0.7 + prior[i] * 0.2 + older[i] * 0.1,
  );
  const levels = resample(smoothed, 64).map((v) => clamp(v * gain));
  const peaks = [...levels];
  // Derive peak hold from timestamps so seeking and export cannot change the result.
  for (let n = 1; n <= 15; n++) {
    const ago = n / data.fps;
    if (time - ago < 0) break;
    const past = resample(spectrumAt(data, time - ago), 64);
    past.forEach(
      (v, i) => (peaks[i] = Math.max(peaks[i], clamp(v * gain) - ago * 1.8)),
    );
  }
  return { levels, peaks };
}
export function drawVisualizer(
  ctx: CanvasRenderingContext2D,
  s: Style,
  data: Spectrum,
  time: number,
) {
  const b = s.visualizerBox,
    { levels, peaks } = visualizerFrame(data, time, s.visualizerGain);
  const glow = s.visualizerGlow ?? 0.35;
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x, b.y, b.w, b.h);
  ctx.clip();
  ctx.globalAlpha = s.visualizerOpacity;
  const gradient = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  gradient.addColorStop(0, s.visualizerColor);
  gradient.addColorStop(0.45, s.visualizerColor + "dd");
  gradient.addColorStop(1, s.visualizerColor + "45");
  ctx.fillStyle = gradient;
  ctx.strokeStyle = s.visualizerColor;
  ctx.shadowColor = s.visualizerColor;
  ctx.shadowBlur = glow * 18;
  if (s.visualizerType === "bars") {
    const step = b.w / levels.length,
      width = step * 0.58;
    const inset = Math.min(8, b.h * 0.1),
      height = b.h - inset * 2,
      base = b.y + b.h - inset;
    levels.forEach((level, i) => {
      const h = Math.max(1.5, level * height),
        x = b.x + i * step + (step - width) / 2;
      ctx.beginPath();
      ctx.roundRect(x, base - h, width, h, Math.min(width / 2, h / 2));
      ctx.fill();
    });
    ctx.shadowBlur = 0;
    ctx.fillStyle = s.visualizerColor;
    peaks.forEach((peak, i) => {
      if (peak < 0.025 || peak - levels[i] < 0.035) return;
      const x = b.x + i * step + (step - width) / 2;
      ctx.globalAlpha = s.visualizerOpacity * 0.6;
      ctx.beginPath();
      ctx.roundRect(x, base - peak * height, width, 1.5, 0.75);
      ctx.fill();
    });
  } else {
    const inset = Math.min(6, b.h * 0.1),
      height = b.h - inset * 2,
      base = b.y + b.h - inset;
    const points = levels.map((v, i) => ({
      x: b.x + (i * b.w) / (levels.length - 1),
      y: base - v * height,
    }));
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        z = points[i],
        mid = (a.x + z.x) / 2;
      ctx.bezierCurveTo(mid, a.y, mid, z.y, z.x, z.y);
    }
    ctx.lineWidth = Math.min(3, b.h * 0.06);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineTo(b.x + b.w, base);
    ctx.lineTo(b.x, base);
    ctx.closePath();
    ctx.globalAlpha = s.visualizerOpacity * 0.22;
    ctx.fill();
  }
  ctx.restore();
}
