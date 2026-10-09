import { resolve } from "node:path";
import express from "express";
import { createApp } from "./routes";
const port = Number(process.env.PORT || 4173),
  host = process.env.HOST || "127.0.0.1",
  origin = `http://127.0.0.1:${port}`,
  root = resolve(process.env.DATA_DIR || ".local-data");
const { app, jobs } = await createApp(root, origin);
const production = process.argv.includes("--production");
if (production) {
  app.use(express.static(resolve("dist")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: {
      middlewareMode: true,
      host: "127.0.0.1",
      hmr: { port: port + 100 },
    },
    appType: "mpa",
  });
  app.use(vite.middlewares);
}
const server = app.listen(port, host, () =>
  console.log(`Lyric Room: ${origin}`),
);
for (const sig of ["SIGINT", "SIGTERM"] as const)
  process.on(sig, async () => {
    await jobs.shutdown();
    server.close();
    process.exit(0);
  });
