import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createSpectrumAnalyzer, type Spectrum } from "../src/audio/spectrum";
import type { Store } from "./store";
import { abortable } from "./abortable";
export function createAnalysis(store: Pick<Store, "resolveAsset">) {
  type Entry = {
    promise: Promise<Spectrum>;
    controller: AbortController;
    users: Set<symbol>;
    settled: boolean;
  };
  const pending = new Map<string, Entry>();
  async function analyze(id: string, audioId: string, signal: AbortSignal) {
    const path = await abortable(store.resolveAsset(id, audioId), signal);
    try {
      const cached = await abortable(
        readFile(path + ".spectrum.json", "utf8"),
        signal,
      );
      return JSON.parse(cached) as Spectrum;
    } catch {
      signal.throwIfAborted();
    }
    const analyzer = createSpectrumAnalyzer(24000);
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        "ffmpeg",
        [
          "-v",
          "error",
          "-i",
          path,
          "-vn",
          "-ac",
          "1",
          "-ar",
          "24000",
          "-f",
          "f32le",
          "pipe:1",
        ],
        { signal },
      );
      let leftover = Buffer.alloc(0),
        error = "";
      const timer = setTimeout(() => proc.kill(), 120000);
      timer.unref();
      proc.stdout.on("data", (chunk: Buffer) => {
        const bytes = Buffer.concat([leftover, chunk]),
          length = bytes.length - (bytes.length % 4),
          samples = new Float32Array(length / 4);
        for (let i = 0; i < samples.length; i++)
          samples[i] = bytes.readFloatLE(i * 4);
        analyzer.push(samples);
        leftover = bytes.subarray(length);
      });
      proc.stderr.on("data", (data) => (error = (error + data).slice(-2000)));
      proc.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      proc.on("close", (code) => {
        clearTimeout(timer);
        code === 0
          ? resolve()
          : reject(Error(error || "음원 분석이 중단되었습니다."));
      });
    });
    signal.throwIfAborted();
    const data = analyzer.finish();
    await writeFile(path + ".spectrum.json", JSON.stringify(data));
    return data;
  }
  return (
    id: string,
    audioId: string,
    signal?: AbortSignal,
  ): Promise<Spectrum> => {
    if (signal?.aborted)
      return Promise.reject(signal.reason || Error("취소됨"));
    const key = id + audioId;
    let entry = pending.get(key);
    if (!entry) {
      const controller = new AbortController();
      entry = {
        controller,
        users: new Set(),
        settled: false,
        promise: analyze(id, audioId, controller.signal),
      };
      pending.set(key, entry);
      const current = entry;
      const finish = () => {
        current.settled = true;
        if (pending.get(key) === current) pending.delete(key);
      };
      current.promise.then(finish, finish);
    }
    const current = entry,
      user = Symbol();
    current.users.add(user);
    return abortable(current.promise, signal).finally(() => {
      current.users.delete(user);
      if (!current.users.size && !current.settled) {
        current.controller.abort();
        if (pending.get(key) === current) pending.delete(key);
      }
    });
  };
}
