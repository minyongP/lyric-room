import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
test("background video loops to the same decoded frame and stays muted", async ({
  page,
  request,
}) => {
  const session = await (await request.get("/api/session")).json(),
    headers = {
      Origin: "http://127.0.0.1:4174",
      "X-Session-Token": session.token,
    };
  const p = await (await request.post("/api/projects", { headers })).json();
  const r = await request.post(`/api/projects/${p.id}/assets`, {
    headers,
    multipart: {
      file: {
        name: "background.mp4",
        mimeType: "video/mp4",
        buffer: await readFile(
          path.resolve(".local-data/fixtures/background.mp4"),
        ),
      },
      role: "background",
      name: "background.mp4",
    },
  });
  p.backgroundId = (await r.json()).id;
  await page.goto("/render.html");
  const data = await page.evaluate(async (p) => {
    const source = "/src/scene/media.ts";
    const module = await import(/* @vite-ignore */ source);
    const media = await module.loadSceneMedia(p);
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 180;
    const ctx = c.getContext("2d")!;
    const snapshot = async (t: number) => {
      const m = await media.at(t);
      ctx.drawImage(m.background, 0, 0, 320, 180);
      return c.toDataURL();
    };
    const first = await snapshot(0.1),
      wrapped = await snapshot(2.1);
    const muted = media.media.background.muted;
    media.dispose();
    return { same: first === wrapped, muted };
  }, p);
  expect(data).toEqual({ same: true, muted: true });
});
test("narrow viewport keeps controls within the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByTestId("audio-input")
    .setInputFiles(path.resolve(".local-data/fixtures/짧은 샘플.mp3"));
  await expect(
    page.getByRole("button", { name: "가사 편집", exact: true }),
  ).toBeVisible();
  const size = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.width);
  await page.screenshot({
    path: ".local-data/verification/mobile.png",
    fullPage: true,
  });
});

test("first exported frame uses the same fonts as subsequent frames", async ({
  page,
  request,
}) => {
  const { token } = await (await request.get("/api/session")).json();
  const p = await (
    await request.post("/api/projects", {
      headers: { Origin: "http://127.0.0.1:4174", "X-Session-Token": token },
    })
  ).json();
  p.duration = 3;
  p.title = "꽃잎 흩날리는 響き";
  p.lyrics = [
    {
      start: 0,
      end: 3,
      original: "響く星空へ 桜舞う夜",
      pronunciation: "꽃잎 흩날리는 밤에",
      translation: "마음속 깊이 울려 퍼지는 노래",
    },
  ];
  await page.goto("/render.html");
  const equal = await page.evaluate(async (p) => {
    const b = (window as any).renderBridge;
    await b.prepare(p, { fps: 30, bands: 32, frames: [] });
    const first = await b.render(0.5);
    await document.fonts.ready;
    return first === (await b.render(0.5));
  }, p);
  expect(equal).toBe(true);
});
