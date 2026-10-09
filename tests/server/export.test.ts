import { test, expect } from "vitest";
import { createJobs } from "../../server/export/jobs";
test("only one active job and cancellation releases slot after cleanup", async () => {
  let release!: () => void;
  const run = async (_p: unknown, signal: AbortSignal) =>
    new Promise<void>((resolve) => {
      release = resolve;
      signal.addEventListener("abort", resolve as () => void);
    });
  const jobs = createJobs(run);
  const a = jobs.start({ id: "test" } as never);
  expect(() => jobs.start({} as never)).toThrow();
  await jobs.cancel(a.id);
  expect(jobs.get(a.id).status).toBe("cancelled");
  const b = jobs.start({} as never);
  await Promise.resolve();
  release();
  await jobs.wait(b.id);
  expect(jobs.get(b.id).status).toBe("completed");
});
test("failure never reports completion and snapshots are immutable", async () => {
  let title = "";
  const jobs = createJobs(async (p) => {
    title = p.title;
    throw Error("encoder failed");
  });
  const p = { title: "before" } as never;
  const j = jobs.start(p);
  (p as { title: string }).title = "after";
  await jobs.wait(j.id);
  expect(title).toBe("before");
  expect(jobs.get(j.id).status).toBe("failed");
  expect(jobs.get(j.id).error).toBe("encoder failed");
});
