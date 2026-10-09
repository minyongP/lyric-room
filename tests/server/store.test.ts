import { test, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../../server/store";
let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "lyric-test-"));
});
afterEach(() => rm(root, { recursive: true, force: true }));
test("save survives reopen and invalid save preserves old version", async () => {
  const store = createStore(root),
    p = await store.create();
  p.title = "한글 제목";
  await store.save(p);
  expect((await createStore(root).load(p.id)).title).toBe("한글 제목");
  await expect(store.save({ ...p, duration: -1 })).rejects.toThrow();
  expect((await store.load(p.id)).duration).toBe(0);
});
test("rejects arbitrary paths, missing and foreign asset IDs", async () => {
  const store = createStore(root),
    p = await store.create();
  await expect(store.load("../outside")).rejects.toThrow();
  await expect(
    store.save({ ...p, coverId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" }),
  ).rejects.toThrow();
  const bad = join(root, "broken.mp3");
  await writeFile(bad, "this is not audio");
  await expect(
    store.importAsset(p.id, bad, "broken.mp3", "audio"),
  ).rejects.toThrow();
});
