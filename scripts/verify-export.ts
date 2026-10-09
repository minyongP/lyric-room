import { run } from "../server/probe";
export async function verifyExport(path: string, expected: number) {
  const data = JSON.parse(
    (
      await run("ffprobe", [
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        path,
      ])
    ).toString(),
  );
  const video = data.streams.find((s: any) => s.codec_type === "video"),
    audio = data.streams.find((s: any) => s.codec_type === "audio");
  if (
    !video ||
    video.width !== 1920 ||
    video.height !== 1080 ||
    video.avg_frame_rate !== "30/1" ||
    video.codec_name !== "h264" ||
    video.pix_fmt !== "yuv420p" ||
    audio?.codec_name !== "aac" ||
    Math.abs(Number(data.format.duration) - expected) > 0.1
  )
    throw Error("출력 사양이 일치하지 않습니다.");
  return {
    width: video.width,
    height: video.height,
    fps: video.avg_frame_rate,
    video: video.codec_name,
    audio: audio.codec_name,
    duration: data.format.duration,
  };
}
if (process.argv[1]?.endsWith("verify-export.ts"))
  console.log(await verifyExport(process.argv[2], Number(process.argv[3])));
