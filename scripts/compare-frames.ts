import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import { run } from "../server/probe";
const base = process.env.APP_URL || "http://127.0.0.1:4175";
const p = JSON.parse(
  await readFile(".local-data/verification/latest-project.json", "utf8"),
);
const spectrum = await (
  await fetch(`${base}/api/projects/${p.id}/analysis/${p.audioId}`)
).json();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  await page.goto(base + "/render.html");
  await page.evaluate(
    async ({ p, spectrum }) =>
      (window as any).renderBridge.prepare(p, spectrum),
    { p, spectrum },
  );
  const results = [];
  for (const time of [0.5, 1.3, 1.5, 2.1]) {
    const ref = `.local-data/verification/preview-${time}.jpg`,
      frame = `.local-data/verification/export-${time}.png`;
    const data = await page.evaluate(
      async (time) => (window as any).renderBridge.render(time),
      time,
    );
    await writeFile(ref, Buffer.from(data, "base64"));
    await run("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-ss",
      String(time),
      "-i",
      ".local-data/verification/smoke-video.mp4",
      "-frames:v",
      "1",
      frame,
    ]);
    const images = await Promise.all(
      [ref, frame].map(
        async (path) =>
          `data:image/${path.endsWith(".png") ? "png" : "jpeg"};base64,${(await readFile(path)).toString("base64")}`,
      ),
    );
    const diff = await page.evaluate(async (images) => {
      const arrays = await Promise.all(
        images.map(async (src) => {
          const image = new Image();
          image.src = src;
          await image.decode();
          const c = document.createElement("canvas");
          c.width = 1920;
          c.height = 1080;
          const ctx = c.getContext("2d")!;
          ctx.drawImage(image, 0, 0);
          return ctx.getImageData(0, 0, 1920, 1080).data;
        }),
      );
      let total = 0;
      for (let i = 0; i < arrays[0].length; i++)
        if (i % 4 !== 3) total += Math.abs(arrays[0][i] - arrays[1][i]);
      return total / (1920 * 1080 * 3);
    }, images);
    if (diff > 5) throw Error(`Frame mismatch at ${time}: ${diff}`);
    results.push({ time, meanAbsoluteRGBError: diff });
  }
  await writeFile(
    ".local-data/verification/frame-comparison.json",
    JSON.stringify(results, null, 2),
  );
  console.log(results);
  await page.goto(base);
  await page.getByRole("button", { name: "바람이 머문 자리" }).first().click();
  await page.getByLabel("재생 위치").fill("0.7");
  await page.waitForTimeout(600);
  await page.screenshot({
    path: ".local-data/verification/editor.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "플레이 화면", exact: true }).click();
  await page.screenshot({
    path: ".local-data/verification/player.png",
    fullPage: true,
  });
} finally {
  await browser.close();
}
