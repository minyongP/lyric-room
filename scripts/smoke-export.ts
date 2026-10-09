import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyExport } from "./verify-export";
const base = process.env.APP_URL || "http://127.0.0.1:4173";
const token = (await (await fetch(base + "/api/session")).json()).token;
const headers = { "X-Session-Token": token, Origin: base };
async function req(url: string, data?: unknown) {
  const r = await fetch(base + "/api" + url, {
    method: data ? "POST" : "GET",
    headers: { ...headers, "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  const json = await r.json();
  if (!r.ok) throw Error(JSON.stringify(json));
  return json;
}
const long = process.argv.includes("--long");
const p = await req("/projects", {});
async function asset(name: string, role: string) {
  const form = new FormData();
  form.append(
    "file",
    new Blob([await readFile(resolve(".local-data/fixtures", name))]),
    name,
  );
  form.append("name", name);
  form.append("role", role);
  const r = await fetch(base + `/api/projects/${p.id}/assets`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!r.ok) throw Error(await r.text());
  return r.json();
}
const a = await asset(long ? "긴 샘플.mp3" : "짧은 샘플.mp3", "audio");
const b = await asset(
  process.argv.includes("--video") ? "background.mp4" : "background.png",
  "background",
);
Object.assign(p, {
  audioId: a.id,
  duration: a.duration,
  backgroundId: b.id,
  title: long ? "긴 영상 검증" : "바람이 머문 자리",
  artist: "Lyric Room",
  lyrics: [
    {
      start: 0.3,
      end: 1.2,
      original: "바람이 머문 자리",
      pronunciation: "A place in the wind",
      translation: "이 순간을 기억해",
    },
    {
      start: 1.4,
      end: long ? 179 : 2.8,
      original: "風の中で",
      translation: "바람 속에서",
    },
  ],
});
await fetch(base + "/api/projects/" + p.id, {
  method: "PUT",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify(p),
});
await mkdir(".local-data/verification", { recursive: true });
await writeFile(
  ".local-data/verification/latest-project.json",
  JSON.stringify(p),
);
const j = await req("/exports", p);
console.log("Export", j.id, "project", p.id, "duration", p.duration);
let last = -1;
for (let i = 0; i < 2400; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const job = await req("/exports/" + j.id);
  if (job.progress !== last) {
    console.log(job.status, job.progress);
    last = job.progress;
  }
  if (job.status === "failed" || job.status === "cancelled")
    throw Error(JSON.stringify(job));
  if (job.status === "completed") {
    const r = await fetch(base + job.downloadUrl);
    const file = resolve(
      ".local-data/verification",
      long
        ? "long.mp4"
        : process.argv.includes("--video")
          ? "smoke-video.mp4"
          : "smoke-photo.mp4",
    );
    await writeFile(file, Buffer.from(await r.arrayBuffer()));
    console.log(await verifyExport(file, p.duration));
    break;
  }
}
