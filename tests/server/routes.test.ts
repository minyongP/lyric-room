import { test, expect } from "vitest";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import request from "supertest";
import { createApp } from "../../server/routes";
test("serves real uploaded assets from hidden data directory including byte ranges", async () => {
  const parent = await mkdtemp(join(tmpdir(), "lyric-http-")),
    root = join(parent, ".local-data");
  const { app, store } = await createApp(root, "http://127.0.0.1:4173");
  try {
    const p = await store.create();
    const asset = await store.importAsset(
      p.id,
      resolve(".local-data/fixtures/짧은 샘플.mp3"),
      "한글 공백.mp3",
      "audio",
    );
    const r = await request(app)
      .get(`/api/projects/${p.id}/assets/${asset.id}`)
      .set("Host", "127.0.0.1:4173")
      .set("Range", "bytes=0-9");
    expect(r.status).toBe(206);
    expect(r.headers["content-length"]).toBe("10");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
