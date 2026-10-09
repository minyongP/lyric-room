import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Project, ExportJob } from "../../src/shared/project";
import type { Spectrum } from "../../src/audio/spectrum";
import type { Store } from "../store";
import { probeFile } from "../probe";
export function createWorker(
  store: Store,
  origin: string,
  analysis: (id: string, audioId: string) => Promise<Spectrum>,
) {
  return async (
    p: Project,
    signal: AbortSignal,
    update: (x: Partial<ExportJob>) => void,
    id: string,
  ) => {
    const check = () => {
      if (signal.aborted) throw Error("취소됨");
    };
    check();
    const spectrum = await analysis(p.id, p.audioId!);
    check();
    const outDir = join(store.root, "exports");
    await mkdir(outDir, { recursive: true });
    const temp = join(outDir, id + ".partial.mp4"),
      result = join(outDir, id + ".mp4");
    const browser = await chromium.launch({ headless: true });
    let proc: ReturnType<typeof spawn> | undefined;
    const abort = () => {
      proc?.kill("SIGKILL");
      void browser.close().catch(() => {});
    };
    signal.addEventListener("abort", abort, { once: true });
    try {
      check();
      const page = await browser.newPage({
        viewport: { width: 1920, height: 1080 },
      });
      await page.goto(origin + "/render.html");
      await page.waitForFunction(() => !!(window as any).renderBridge);
      await page.evaluate(
        async ({ p, spectrum }) =>
          (window as any).renderBridge.prepare(p, spectrum),
        { p, spectrum },
      );
      check();
      const input = await store.resolveAsset(p.id, p.audioId!);
      proc = spawn(
        "ffmpeg",
        [
          "-y",
          "-v",
          "error",
          "-f",
          "image2pipe",
          "-framerate",
          "30",
          "-vcodec",
          "mjpeg",
          "-i",
          "pipe:0",
          "-i",
          input,
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "20",
          "-vf",
          "scale=in_range=full:out_range=tv,format=yuv420p",
          "-color_range",
          "tv",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-t",
          p.duration.toString(),
          "-movflags",
          "+faststart",
          temp,
        ],
        { stdio: ["pipe", "ignore", "pipe"] },
      );
      let error = "";
      proc.stderr!.on("data", (d) => (error = (error + d).slice(-3000)));
      proc.stdin!.on("error", () => {});
      let failed: Error | undefined;
      const completion = new Promise<void>((resolve, reject) => {
        proc!.on("error", reject);
        proc!.on("close", (code) =>
          code === 0 ? resolve() : reject(Error(error || "FFmpeg 인코딩 실패")),
        );
      }).catch((e) => {
        failed = e;
      });
      const count = Math.ceil(p.duration * 30);
      for (let n = 0; n < count; n++) {
        check();
        if (failed) throw failed;
        const data = await page.evaluate(
          async (t) => (window as any).renderBridge.render(t),
          n / 30,
        );
        if (!proc.stdin!.write(Buffer.from(data, "base64")))
          await Promise.race([
            once(proc.stdin!, "drain"),
            completion.then(() => {
              throw failed || Error("인코더가 일찍 종료되었습니다.");
            }),
          ]);
        if (n % 5 === 0)
          update({
            status: "rendering",
            progress: Math.round((n / count) * 95),
          });
      }
      proc.stdin!.end();
      update({ status: "encoding", progress: 96 });
      await completion;
      if (failed) throw failed;
      check();
      const meta = await probeFile(temp);
      if (
        !meta.streams.some((s) => s.codec_type === "audio") ||
        Math.abs(meta.duration - p.duration) > 0.1
      )
        throw Error("출력 영상 검증에 실패했습니다.");
      await rename(temp, result);
    } finally {
      signal.removeEventListener("abort", abort);
      proc?.kill();
      await browser.close();
      await rm(temp, { force: true });
    }
  };
}
