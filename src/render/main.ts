import "../fonts.css";
import { drawScene } from "../scene/draw";
import { loadFonts, loadSceneMedia } from "../scene/media";
import type { Project } from "../shared/project";
import type { Spectrum } from "../audio/spectrum";
const canvas = document.querySelector("canvas")!;
const ctx = canvas.getContext("2d")!;
let project: Project,
  spectrum: Spectrum,
  media: Awaited<ReturnType<typeof loadSceneMedia>>;
const bridge = {
  async prepare(p: Project, s: Spectrum) {
    project = p;
    spectrum = s;
    await loadFonts(p);
    media = await loadSceneMedia(p);
  },
  async render(t: number) {
    const m = await media.at(t);
    drawScene(ctx, project, t, spectrum, m);
    return canvas.toDataURL("image/jpeg", 0.94).split(",")[1];
  },
};
(window as unknown as { renderBridge: typeof bridge }).renderBridge = bridge;
