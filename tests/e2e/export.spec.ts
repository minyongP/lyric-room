import { test, expect } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { verifyExport } from "../../scripts/verify-export";
for (const bg of ["background.png", "background.mp4"])
  test("actual 1080p export with " + bg, async ({ request }) => {
    const origin = "http://127.0.0.1:4174",
      session = await (await request.get("/api/session")).json(),
      headers = { Origin: origin, "X-Session-Token": session.token };
    const p = await (await request.post("/api/projects", { headers })).json();
    const asset = async (file: string, role: string) =>
      (
        await request.post(`/api/projects/${p.id}/assets`, {
          headers,
          multipart: {
            file: {
              name: file,
              mimeType:
                role === "audio"
                  ? "audio/mpeg"
                  : file.endsWith(".png")
                    ? "image/png"
                    : "video/mp4",
              buffer: await readFile(
                path.resolve(".local-data/fixtures", file),
              ),
            },
            name: file,
            role,
          },
        })
      ).json();
    const audio = await asset("짧은 샘플.mp3", "audio"),
      background = await asset(bg, "background");
    Object.assign(p, {
      audioId: audio.id,
      duration: audio.duration,
      backgroundId: background.id,
      title: "검증용 음악",
      artist: "Lyric Room",
      lyrics: [
        {
          start: 0.3,
          end: 1.2,
          original: "바람이 머문 자리",
          translation: "Our song",
        },
        {
          start: 1.4,
          end: 2.8,
          original: "風の中で",
          translation: "바람 속에서",
        },
      ],
    });
    expect(
      (await request.put(`/api/projects/${p.id}`, { headers, data: p })).ok(),
    ).toBe(true);
    const response = await request.post("/api/exports", { headers, data: p });
    expect(response.status()).toBe(202);
    const job = await response.json();
    let result = job;
    await expect
      .poll(
        async () => {
          result = await (await request.get(`/api/exports/${job.id}`)).json();
          return ["completed", "failed", "cancelled"].includes(result.status);
        },
        { timeout: 110000, intervals: [500, 1000] },
      )
      .toBe(true);
    expect(result.status, result.error).toBe("completed");
    const bytes = await (await request.get(result.downloadUrl)).body();
    await mkdir(".local-data/verification", { recursive: true });
    const file = path.resolve(".local-data/verification", bg + ".mp4");
    await writeFile(file, bytes);
    expect((await verifyExport(file, p.duration)).video).toBe("h264");
  });

test("cancel active export and render again without overwriting successful output", async ({
  request,
}) => {
  const session = await (await request.get("/api/session")).json(),
    headers = {
      Origin: "http://127.0.0.1:4174",
      "X-Session-Token": session.token,
    };
  const recent = await (await request.get("/api/projects")).json();
  const p = await (await request.get("/api/projects/" + recent[0].id)).json();
  const first = await (
    await request.post("/api/exports", { headers, data: p })
  ).json();
  const cancel = await request.post("/api/exports/" + first.id + "/cancel", {
    headers,
  });
  expect(cancel.ok()).toBe(true);
  expect((await cancel.json()).status).toBe("cancelled");
  expect(
    (await request.get("/api/exports/" + first.id + "/download")).status(),
  ).toBe(409);
  const next = await (
    await request.post("/api/exports", { headers, data: p })
  ).json();
  let result: any;
  await expect
    .poll(
      async () => {
        result = await (await request.get("/api/exports/" + next.id)).json();
        return ["completed", "failed"].includes(result.status);
      },
      { timeout: 100000 },
    )
    .toBe(true);
  expect(result.status, result.error).toBe("completed");
  expect(next.id).not.toBe(first.id);
});
