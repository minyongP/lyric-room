import { spawn } from "node:child_process";
export function run(
  command: string,
  args: string[],
  max = 8 * 1024 * 1024,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] }),
      out: Buffer[] = [];
    let length = 0,
      error = "";
    proc.stdout.on("data", (d: Buffer) => {
      length += d.length;
      if (length > max) {
        proc.kill();
        reject(Error("미디어 처리 결과가 제한을 초과했습니다."));
      } else out.push(d);
    });
    proc.stderr.on(
      "data",
      (d) => (error = (error + d.toString()).slice(-4000)),
    );
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0
        ? resolve(Buffer.concat(out))
        : reject(Error(error || `${command} 실행 실패`)),
    );
    setTimeout(() => proc.kill(), 30000).unref();
  });
}
export async function probeFile(path: string) {
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
  return {
    streams: data.streams as {
      codec_type: string;
      codec_name: string;
      width?: number;
      height?: number;
      duration?: string;
    }[],
    duration: Number(data.format?.duration) || 0,
    format: String(data.format?.format_name || ""),
  };
}
export async function health() {
  try {
    const [encoders] = await Promise.all([
      run("ffmpeg", ["-hide_banner", "-encoders"]),
      run("ffprobe", ["-version"]),
    ]);
    const available = encoders.includes("libx264") && encoders.includes("aac");
    return {
      ffmpeg: available,
      error: available
        ? undefined
        : "FFmpeg의 libx264/AAC 인코더가 필요합니다.",
    };
  } catch {
    return {
      ffmpeg: false,
      error: "FFmpeg와 ffprobe를 설치해 주세요. macOS: brew install ffmpeg",
    };
  }
}
