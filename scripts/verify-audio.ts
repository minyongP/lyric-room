import { run } from "../server/probe";
const files = process.argv.slice(2);
if (files.length !== 2)
  throw Error("Usage: verify-audio.ts source.mp3 output.mp4");
const pcm = await Promise.all(
  files.map((f) =>
    run("ffmpeg", [
      "-v",
      "error",
      "-i",
      f,
      "-t",
      "3",
      "-vn",
      "-ac",
      "1",
      "-ar",
      "24000",
      "-f",
      "f32le",
      "pipe:1",
    ]),
  ),
);
const samples = pcm.map((b) =>
  Float32Array.from({ length: b.length / 4 }, (_, i) => b.readFloatLE(i * 4)),
);
let best = { lagMs: 0, mse: Infinity };
for (let lag = -2400; lag <= 2400; lag += 24) {
  let squared = 0,
    count = 0;
  for (
    let i = 2400;
    i < Math.min(samples[0].length, samples[1].length) - 2400;
    i += 4
  ) {
    squared += (samples[0][i] - samples[1][i + lag]) ** 2;
    count++;
  }
  const mse = squared / count;
  if (mse < best.mse) best = { lagMs: lag / 24, mse };
}
if (Math.abs(best.lagMs) > 33.334)
  throw Error(
    `Audio differs by more than one video frame: ${JSON.stringify(best)}`,
  );
console.log({
  ...best,
  method: "decoded mono PCM, ±100ms search at 1ms intervals, first 3 seconds",
});
