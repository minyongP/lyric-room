import type { Asset, Project } from "../shared/project";
export interface SceneMedia {
  background?: HTMLImageElement | HTMLVideoElement;
  cover?: HTMLImageElement;
}
export const assetUrl = (p: Project, id: string) =>
  `/api/projects/${p.id}/assets/${id}`;
export async function loadSceneMedia(p: Project): Promise<{
  media: SceneMedia;
  at(t: number): Promise<SceneMedia>;
  dispose(): void;
}> {
  const media: SceneMedia = {};
  let disposed = false;
  async function image(id: string) {
    const img = new Image();
    img.src = assetUrl(p, id);
    await img.decode();
    return img;
  }
  try {
    await Promise.all([
      p.coverId
        ? image(p.coverId).then((x) => {
            media.cover = x;
          })
        : null,
      p.backgroundId
        ? (async () => {
            const meta = await fetch(
              assetUrl(p, p.backgroundId!) + "/meta",
            ).then((r) => {
              if (!r.ok) throw Error("배경 파일을 찾을 수 없습니다.");
              return r.json() as Promise<Asset>;
            });
            if (meta.kind === "video") {
              const v = document.createElement("video");
              v.muted = true;
              v.playsInline = true;
              v.preload = "auto";
              v.src = assetUrl(p, p.backgroundId!);
              media.background = v;
              await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                  cleanup();
                  reject(Error("배경 영상 로딩 시간 초과"));
                }, 20000);
                const cleanup = () => {
                  clearTimeout(timeout);
                  v.onloadeddata = null;
                  v.onerror = null;
                };
                v.onloadeddata = () => {
                  cleanup();
                  resolve();
                };
                v.onerror = () => {
                  cleanup();
                  reject(Error("배경 영상을 읽을 수 없습니다."));
                };
              });
            } else media.background = await image(p.backgroundId!);
          })()
        : null,
    ]);
  } catch (e) {
    if (media.background instanceof HTMLVideoElement) {
      media.background.removeAttribute("src");
      media.background.load();
    }
    throw e;
  }
  return {
    media,
    async at(t) {
      if (disposed) throw Error("미디어가 해제되었습니다.");
      const v = media.background;
      if (v instanceof HTMLVideoElement) {
        const start = Math.min(
            p.style.backgroundStart,
            Math.max(0, v.duration - 0.05),
          ),
          length = v.duration - start;
        const target = p.style.backgroundLoop
          ? start + (t % length)
          : Math.min(start + t, v.duration - 0.025);
        if (Math.abs(v.currentTime - target) > 0.0001)
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              v.removeEventListener("seeked", done);
              reject(Error("배경 영상 탐색 시간 초과"));
            }, 10000);
            const done = () => {
              clearTimeout(timeout);
              resolve();
            };
            v.addEventListener("seeked", done, { once: true });
            v.currentTime = target;
          });
      }
      return media;
    },
    dispose() {
      disposed = true;
      if (media.background instanceof HTMLVideoElement) {
        media.background.pause();
        media.background.removeAttribute("src");
        media.background.load();
      }
    },
  };
}
export async function loadFonts(project?: Project) {
  const text = project
    ? [
        ...new Set(
          [
            project.title,
            project.artist,
            ...project.lyrics.flatMap((c) => [
              c.original,
              c.pronunciation ?? "",
              c.translation ?? "",
            ]),
          ].join(""),
        ),
      ].join("") + "0123456789:"
    : "가나다 ABC 0123456789:";
  await Promise.all(
    ["Noto Sans KR", "Noto Sans JP"].flatMap((family) =>
      ["400", "700"].map((weight) =>
        document.fonts.load(`${weight} 48px "${family}"`, text),
      ),
    ),
  );
  await document.fonts.ready;
}
