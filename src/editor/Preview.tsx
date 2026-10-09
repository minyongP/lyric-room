import { useEffect, useRef, useState } from "react";
import type { Project, Part, Box } from "../shared/project";
import { drawScene } from "../scene/draw";
import { loadFonts, loadSceneMedia } from "../scene/media";
import { clampBox } from "../scene/layout";
import type { Spectrum } from "../audio/spectrum";
export function Preview({
  project,
  time,
  spectrum,
  selected,
  onSelect,
  onBox,
  onError,
  onOverflow,
  playMode,
}: {
  project: Project;
  time: number;
  spectrum: Spectrum;
  selected: Part;
  onSelect: (p: Part) => void;
  onBox: (part: Part, box: Box) => void;
  onError: (s: string) => void;
  onOverflow: (n: number[]) => void;
  playMode: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [ready, setReady] = useState(false);
  const data = useRef({ project, time, spectrum, onError, onOverflow });
  data.current = { project, time, spectrum, onError, onOverflow };
  const lastOverflow = useRef("");
  useEffect(() => {
    void loadFonts(project).catch((e) =>
      data.current.onError((e as Error).message),
    );
  }, [project.title, project.artist, project.lyrics]);
  useEffect(() => {
    let stopped = false,
      controller: Awaited<ReturnType<typeof loadSceneMedia>> | undefined,
      raf = 0;
    setReady(false);
    (async () => {
      await loadFonts(project);
      controller = await loadSceneMedia(project);
      if (stopped) {
        controller.dispose();
        return;
      }
      setReady(true);
      const frame = async () => {
        if (stopped) return;
        try {
          const d = data.current,
            media = await controller!.at(d.time);
          if (stopped) return;
          const result = drawScene(
            canvas.current!.getContext("2d")!,
            d.project,
            d.time,
            d.spectrum,
            media,
          );
          const key = result.overflowCueIndices.join(",");
          if (key !== lastOverflow.current) {
            lastOverflow.current = key;
            d.onOverflow(result.overflowCueIndices);
          }
        } catch (e) {
          if (!stopped) data.current.onError((e as Error).message);
          return;
        }
        raf = requestAnimationFrame(frame);
      };
      void frame();
    })().catch((e) => {
      if (!stopped) onError((e as Error).message);
    });
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      controller?.dispose();
    };
  }, [
    project.id,
    project.coverId,
    project.backgroundId,
    project.style.backgroundStart,
    project.style.backgroundLoop,
  ]);
  function drag(
    e: React.PointerEvent<HTMLButtonElement>,
    part: Part,
    resize = false,
  ) {
    if (playMode) return;
    e.preventDefault();
    onSelect(part);
    const box = project.style[(part + "Box") as "lyricsBox"],
      rect = canvas.current!.getBoundingClientRect(),
      start = { x: e.clientX, y: e.clientY };
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const move = (event: PointerEvent) => {
      const dx = ((event.clientX - start.x) * 1920) / rect.width,
        dy = ((event.clientY - start.y) * 1080) / rect.height;
      onBox(
        part,
        clampBox(
          resize
            ? { ...box, w: box.w + dx, h: box.h + dy }
            : { ...box, x: box.x + dx, y: box.y + dy },
        ),
      );
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  }
  return (
    <div className="preview" data-testid="preview">
      <canvas
        ref={canvas}
        width="1920"
        height="1080"
        aria-label="음악 영상 미리보기"
      />
      {!ready && <div className="loading">장면 준비 중…</div>}
      {!playMode &&
        (["lyrics", "player", "visualizer"] as const).map((part) => {
          const b = project.style[`${part}Box`],
            visible =
              part === "lyrics"
                ? project.style.showLyrics
                : part === "visualizer"
                  ? project.style.showVisualizer
                  : true;
          if (!visible) return null;
          return (
            <div
              key={part}
              className={
                "scene-target " + (selected === part ? "selected" : "")
              }
              style={{
                left: b.x / 19.2 + "%",
                top: b.y / 10.8 + "%",
                width: b.w / 19.2 + "%",
                height: b.h / 10.8 + "%",
              }}
            >
              <button
                className="drag-surface"
                aria-label={`${part === "lyrics" ? "가사" : part === "player" ? "플레이어" : "시각 효과"} 위치 이동`}
                onPointerDown={(e) => drag(e, part)}
                onClick={() => onSelect(part)}
              />
              {selected === part && (
                <button
                  className="resize-handle"
                  aria-label="선택 요소 크기 조절"
                  onPointerDown={(e) => drag(e, part, true)}
                />
              )}
            </div>
          );
        })}
    </div>
  );
}
