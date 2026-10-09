import express from "express";
import multer from "multer";
import { mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createStore, AppError, validId } from "./store";
import { localGuard } from "./auth";
import { createAnalysis } from "./analysis";
import { health } from "./probe";
import { createJobs } from "./export/jobs";
import { createWorker } from "./export/worker";
import { chromium } from "playwright";
import { existsSync } from "node:fs";
export async function createApp(root: string, origin: string) {
  const app = express(),
    token = randomUUID(),
    store = createStore(root),
    analysis = createAnalysis(store);
  await mkdir(join(root, "uploads"), { recursive: true });
  const upload = multer({
    dest: join(root, "uploads"),
    limits: { fileSize: 512 * 1024 * 1024, files: 1, fields: 2 },
  });
  const jobs = createJobs(createWorker(store, origin, analysis));
  app.disable("x-powered-by");
  app.use(localGuard(origin, token));
  app.use(express.json({ limit: "4mb" }));
  app.get("/api/session", (_q, r) => {
    r.setHeader("Cache-Control", "no-store");
    r.json({ token });
  });
  app.get("/api/health", async (_q, r) =>
    r.json({
      ...(await health()),
      chromium: existsSync(chromium.executablePath()),
    }),
  );
  app.get("/api/projects", async (_q, r) => r.json(await store.list()));
  app.post("/api/projects", async (_q, r) =>
    r.status(201).json(await store.create()),
  );
  app.get("/api/projects/:id", async (q, r) =>
    r.json(await store.load(q.params.id)),
  );
  app.put("/api/projects/:id", async (q, r) => {
    if (q.body.id !== q.params.id)
      throw new AppError("프로젝트 ID가 일치하지 않습니다.");
    await store.save(q.body);
    r.json({ ok: true });
  });
  app.post("/api/projects/:id/assets", upload.single("file"), async (q, r) => {
    if (!q.file) throw new AppError("파일을 선택해 주세요.");
    try {
      const name =
        q.body.name ||
        Buffer.from(q.file.originalname, "latin1").toString("utf8");
      r.json(
        await store.importAsset(
          q.params.id as string,
          q.file.path,
          name,
          q.body.role,
        ),
      );
    } finally {
      await rm(q.file.path, { force: true });
    }
  });
  app.get("/api/projects/:id/assets/:assetId/meta", async (q, r) =>
    r.json(await store.asset(q.params.id, q.params.assetId)),
  );
  app.get("/api/projects/:id/assets/:assetId", async (q, r) => {
    const path = await store.resolveAsset(q.params.id, q.params.assetId);
    r.sendFile(path, { dotfiles: "allow" });
  });
  app.get("/api/projects/:id/analysis/:audioId", async (q, r) => {
    const meta = await store.asset(q.params.id, q.params.audioId);
    if (meta.kind !== "audio") throw new AppError("음원이 아닙니다.");
    r.json(await analysis(q.params.id, q.params.audioId));
  });
  app.post("/api/exports", async (q, r) => {
    const p = await store.validate(q.body);
    if (!p.audioId || !p.duration)
      throw new AppError("음악을 먼저 열어 주세요.");
    r.status(202).json(jobs.start(p));
  });
  app.get("/api/exports/:id", (q, r) => r.json(jobs.get(q.params.id)));
  app.post("/api/exports/:id/cancel", async (q, r) => {
    await jobs.cancel(q.params.id);
    r.json(jobs.get(q.params.id));
  });
  app.get("/api/exports/:id/download", (q, r) => {
    const job = jobs.get(q.params.id);
    if (job.status !== "completed")
      throw new AppError("영상이 아직 준비되지 않았습니다.", 409);
    r.download(
      join(root, "exports", validId(job.id) + ".mp4"),
      "lyric-room-" + job.id.slice(0, 8) + ".mp4",
      { dotfiles: "allow" },
    );
  });
  app.use("/api", (_q, r) =>
    r.status(404).json({ error: "요청한 기능이 없습니다." }),
  );
  app.use(
    (
      err: any,
      _q: express.Request,
      r: express.Response,
      _next: express.NextFunction,
    ) => {
      r.status(err instanceof AppError ? err.status : 400).json({
        error: err instanceof Error ? err.message : "처리에 실패했습니다.",
      });
    },
  );
  return { app, jobs, store };
}
