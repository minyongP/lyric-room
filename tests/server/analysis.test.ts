import { test, expect } from "vitest";
import { createAnalysis } from "../../server/analysis";
import { createJobs } from "../../server/export/jobs";
import { createWorker } from "../../server/export/worker";
import type { Store } from "../../server/store";
import { newProject } from "../../src/shared/project";
import { randomUUID } from "node:crypto";
import { mkdtemp, copyFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
test("cancel during unresolved analysis promptly releases export slot", async () => {
  const store = {
    root: tmpdir(),
    resolveAsset: () => new Promise<string>(() => {}),
  };
  const jobs = createJobs(
    createWorker(store, "http://127.0.0.1:1", createAnalysis(store)),
  );
  const p = newProject(randomUUID());
  p.audioId = randomUUID();
  p.duration = 3;
  const job = jobs.start(p);
  await new Promise((r) => setTimeout(r, 10));
  const result = await Promise.race([
    jobs.cancel(job.id).then(() => true),
    new Promise((r) => setTimeout(() => r(false), 150)),
  ]);
  expect(result).toBe(true);
  expect(jobs.get(job.id).status).toBe("cancelled");
  const next = jobs.start(p);
  await jobs.cancel(next.id);
  expect(jobs.get(next.id).status).toBe("cancelled");
});
test("cancelling one analysis consumer preserves another preview consumer", async () => {
  const root = await mkdtemp(join(tmpdir(), "analysis-"));
  try {
    const file = join(root, "audio.mp3");
    await copyFile(resolve(".local-data/fixtures/긴 샘플.mp3"), file);
    const store = { resolveAsset: async () => file },
      analyze = createAnalysis(store),
      controller = new AbortController();
    const cancelled = analyze("project", "audio", controller.signal),
      preview = analyze("project", "audio");
    controller.abort();
    await expect(cancelled).rejects.toThrow();
    const spectrum = await preview;
    expect(spectrum.frames.length).toBeGreaterThanOrEqual(5400);
    await access(file + ".spectrum.json");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
