import { useRef, useState } from "react";
import {
  Image,
  Type,
  PanelBottom,
  AudioLines,
  Upload,
  RotateCcw,
} from "lucide-react";
import type { Project, Style, Part, Box } from "../shared/project";
import { defaultStyle } from "../shared/project";
import { parseLyrics, type LyricCue } from "../shared/lyrics";
import { clampBox } from "../scene/layout";
export const parts = [
  { id: "background", label: "배경", Icon: Image },
  { id: "lyrics", label: "가사", Icon: Type },
  { id: "player", label: "플레이어", Icon: PanelBottom },
  { id: "visualizer", label: "시각 효과", Icon: AudioLines },
] as const;
export function Inspector({
  p,
  part,
  update,
  onAsset,
  onSeek,
  onError,
}: {
  p: Project;
  part: Part;
  update: (x: Partial<Project>) => void;
  onAsset: (file: File, role: "background" | "cover") => Promise<void>;
  onSeek: (t: number) => void;
  onError: (s: string) => void;
}) {
  const file = useRef<HTMLInputElement>(null),
    jsonFile = useRef<HTMLInputElement>(null);
  const [json, setJson] = useState<string | null>(null),
    [validation, setValidation] = useState("");
  const s = p.style;
  function style<K extends keyof Style>(key: K, value: Style[K]) {
    update({ style: { ...s, [key]: value } });
  }
  const slider = (
    key: keyof Style,
    label: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <label className="field" key={key}>
      <span>
        {label}
        <output>{Math.round(Number(s[key]) * 100) / 100}</output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number(s[key])}
        onChange={(e) => style(key, Number(e.target.value) as never)}
      />
    </label>
  );
  const toggle = (key: keyof Style, label: string) => (
    <label className="toggle" key={key}>
      {label}
      <input
        type="checkbox"
        checked={!!s[key]}
        onChange={(e) => style(key, e.target.checked as never)}
      />
    </label>
  );
  const color = (key: keyof Style, label: string) => (
    <label className="color-field" key={key}>
      {label}
      <input
        type="color"
        aria-label={label}
        value={String(s[key])}
        onChange={(e) => style(key, e.target.value as never)}
      />
    </label>
  );
  const select = (
    key: keyof Style,
    label: string,
    options: [string, string][],
  ) => (
    <label className="field" key={key}>
      <span>{label}</span>
      <select
        value={String(s[key])}
        onChange={(e) => style(key, e.target.value as never)}
      >
        {options.map(([value, text]) => (
          <option value={value} key={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  function setLyrics(cues: LyricCue[]) {
    update({ lyrics: cues });
    const result = parseLyrics({ lyrics: cues }, p.duration);
    setValidation(
      result.ok
        ? ""
        : result.errors.map((e) => `${e.cue || ""}행: ${e.message}`).join("\n"),
    );
  }
  function changeCue(i: number, patch: Partial<LyricCue>) {
    setLyrics(p.lyrics.map((c, j) => (i === j ? { ...c, ...patch } : c)));
  }
  function applyJson() {
    try {
      const r = parseLyrics(JSON.parse(json!), p.duration);
      if (!r.ok) {
        setValidation(
          r.errors.map((e) => `${e.cue || ""}행: ${e.message}`).join("\n"),
        );
        return;
      }
      setLyrics(r.lyrics);
      setValidation("");
      setJson(null);
    } catch {
      setValidation("JSON 형식을 확인해 주세요.");
    }
  }
  const layout = part !== "background" ? s[`${part}Box`] : null;
  return (
    <aside className="inspector">
      <header>
        <span>속성</span>
        <strong>{parts.find((x) => x.id === part)?.label}</strong>
      </header>
      <div className="properties">
        <input
          ref={file}
          type="file"
          hidden
          accept={
            part === "player"
              ? "image/jpeg,image/png,image/webp"
              : "image/jpeg,image/png,image/webp,video/mp4"
          }
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onAsset(f, part === "player" ? "cover" : "background");
            e.target.value = "";
          }}
        />
        {part === "background" && (
          <>
            <h3>배경 이미지 · 영상</h3>
            <button className="wide" onClick={() => file.current?.click()}>
              <Upload size={15} />
              배경 파일 선택
            </button>
            {p.backgroundId && (
              <button
                className="quiet wide"
                onClick={() => update({ backgroundId: undefined })}
              >
                배경 제거
              </button>
            )}
            <p className="hint">
              JPG · PNG · WebP · MP4
              <br />
              배경 영상은 소리 없이 재생됩니다.
            </p>
            {select("backgroundFit", "채우기", [
              ["cover", "화면 채우기"],
              ["contain", "전체 맞추기"],
            ])}
            {slider("backgroundBrightness", "밝기", 0, 1.5, 0.05)}
            {slider("backgroundBlur", "흐림", 0, 30)}
            {slider("backgroundScale", "확대", 1, 3, 0.05)}
            {slider("backgroundX", "가로 위치", -1, 1, 0.05)}
            {slider("backgroundY", "세로 위치", -1, 1, 0.05)}
            {toggle("backgroundLoop", "영상 반복")}
            <label className="field">
              <span>영상 시작 지점 (초)</span>
              <input
                type="number"
                min="0"
                max="86400"
                step=".1"
                value={s.backgroundStart}
                onChange={(e) =>
                  style("backgroundStart", Math.max(0, Number(e.target.value)))
                }
              />
            </label>
          </>
        )}
        {part === "lyrics" && (
          <>
            <h3>가사</h3>
            <div className="button-row">
              <button
                onClick={() => {
                  setValidation("");
                  setJson(
                    JSON.stringify(
                      { schemaVersion: 1, lyrics: p.lyrics },
                      null,
                      2,
                    ),
                  );
                }}
              >
                JSON 가져오기
              </button>
              <button
                onClick={() => jsonFile.current?.click()}
                aria-label="가사 파일 열기"
              >
                <Upload size={15} />
              </button>
            </div>
            <input
              ref={jsonFile}
              hidden
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 4e6) {
                    onError("가사 파일은 4MB 이내로 선택해 주세요.");
                    return;
                  }
                  setValidation("");
                  setJson(await f.text());
                }
                e.target.value = "";
              }}
            />
            <button
              className="quiet wide"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `가사를 다음 JSON으로 정리해 주세요. 시간은 초 단위, 0 ≤ start < end ≤ ${p.duration.toFixed(2)}, 오름차순, 구절 겹침 금지. 시간은 음원을 듣고 확인하고 추정값이면 별도로 알려 주세요. 형식: {"schemaVersion":1,"lyrics":[{"start":0,"end":3,"original":"원문","pronunciation":"발음 (선택)","translation":"번역 (선택)"}]}`,
                  );
                  onError("AI용 형식을 복사했습니다.");
                } catch {
                  onError(
                    "클립보드 접근이 불가능합니다. JSON 가져오기에서 형식을 확인해 주세요.",
                  );
                }
              }}
            >
              AI용 형식 복사
            </button>
            {toggle("showLyrics", "가사 표시")}
            {toggle("showOriginal", "원문")}
            {toggle("showPronunciation", "발음")}
            {toggle("showTranslation", "번역")}
            {slider("fontSize", "글자 크기", 24, 80)}
            {select("fontFamily", "글꼴", [
              ["sans", "Noto Sans"],
              ["serif", "Serif"],
            ])}
            {select("align", "정렬", [
              ["left", "왼쪽"],
              ["center", "가운데"],
              ["right", "오른쪽"],
            ])}
            {slider("lineGap", "줄 간격", 0, 40)}
            {color("textColor", "글자 색상")}
            <h3>가사 패널</h3>
            {color("panelColor", "패널 색상")}
            {slider("panelOpacity", "패널 농도", 0, 1, 0.05)}
            {slider("panelRadius", "모서리", 0, 80)}
            <details open>
              <summary>가사 타이밍 · {p.lyrics.length}구절</summary>
              {p.lyrics.map((c, i) => (
                <div className="cue-editor" key={i}>
                  <div className="cue-head">
                    <button className="quiet" onClick={() => onSeek(c.start)}>
                      구절 {i + 1}
                    </button>
                    <button
                      className="quiet"
                      aria-label={`구절 ${i + 1} 삭제`}
                      onClick={() =>
                        setLyrics(p.lyrics.filter((_, j) => j !== i))
                      }
                    >
                      ×
                    </button>
                  </div>
                  <div className="cue-times">
                    <label>
                      시작
                      <input
                        aria-label={`시작 ${i + 1}`}
                        type="number"
                        min="0"
                        step=".1"
                        value={c.start}
                        onChange={(e) =>
                          changeCue(i, { start: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      종료
                      <input
                        aria-label={`종료 ${i + 1}`}
                        type="number"
                        min="0"
                        step=".1"
                        value={c.end}
                        onChange={(e) =>
                          changeCue(i, { end: Number(e.target.value) })
                        }
                      />
                    </label>
                  </div>
                  {(["original", "pronunciation", "translation"] as const).map(
                    (key, j) => (
                      <textarea
                        key={key}
                        aria-label={`${["원문", "발음", "번역"][j]} ${i + 1}`}
                        placeholder={["원문", "발음", "번역"][j]}
                        rows={1}
                        value={c[key] || ""}
                        onChange={(e) =>
                          changeCue(i, { [key]: e.target.value })
                        }
                      />
                    ),
                  )}
                </div>
              ))}
              <button
                className="wide"
                onClick={() => {
                  const start = p.lyrics.at(-1)?.end || 0;
                  if (start >= p.duration) {
                    onError(
                      "곡 끝에 도달했습니다. 마지막 구절 시간을 조절해 주세요.",
                    );
                    return;
                  }
                  setLyrics([
                    ...p.lyrics,
                    {
                      start,
                      end: Math.min(p.duration, start + 5),
                      original: "새 가사",
                    },
                  ]);
                }}
              >
                + 구절 추가
              </button>
            </details>
          </>
        )}
        {part === "player" && (
          <>
            <h3>곡 정보</h3>
            <label className="field">
              <span>곡 이름</span>
              <input
                maxLength={200}
                value={p.title}
                onChange={(e) => update({ title: e.target.value })}
              />
            </label>
            <label className="field">
              <span>가수 이름</span>
              <input
                maxLength={200}
                value={p.artist}
                onChange={(e) => update({ artist: e.target.value })}
              />
            </label>
            <button className="wide" onClick={() => file.current?.click()}>
              <Upload size={15} />
              앨범 커버 바꾸기
            </button>
            {p.coverId && (
              <button
                className="quiet wide"
                onClick={() => update({ coverId: undefined })}
              >
                커버 제거
              </button>
            )}
            {toggle("showCover", "앨범 커버")}
            {toggle("showTitle", "곡 이름 표시")}
            {toggle("showArtist", "가수 이름 표시")}
            {toggle("showControls", "플레이 화면 재생 버튼")}
            {toggle("showProgress", "재생 진행 바")}
            {slider("coverSize", "커버 너비", 60, 230)}
            {slider("coverRadius", "커버 모서리", 0, 100)}
            {slider("infoSize", "곡 이름 크기", 24, 64)}
            {color("playerColor", "플레이어 색상")}
            {slider("playerOpacity", "플레이어 농도", 0, 1, 0.05)}
            {slider("playerRadius", "플레이어 모서리", 0, 80)}
            <p className="hint">
              조작 버튼은 감상 화면에서만 보이며 내보낸 영상에는 포함되지
              않습니다.
            </p>
          </>
        )}
        {part === "visualizer" && (
          <>
            <h3>오디오 비주얼라이저</h3>
            {toggle("showVisualizer", "시각 효과 표시")}
            {select("visualizerType", "모양", [
              ["bars", "스펙트럼 막대"],
              ["wave", "스펙트럼 라인"],
            ])}
            {color("visualizerColor", "시각 효과 색상")}
            {slider("visualizerOpacity", "불투명도", 0, 1, 0.05)}
            {slider("visualizerGain", "반응 강도", 0.2, 3, 0.1)}
            <p className="hint">
              현재 음원의 주파수 분석 결과를 사용합니다. 미리보기와 출력
              영상에서 동일하게 반응합니다.
            </p>
          </>
        )}
        {layout && (
          <details>
            <summary>위치 · 크기</summary>
            <div className="box-fields">
              {(["x", "y", "w", "h"] as const).map((key, i) => (
                <label key={key}>
                  {["X", "Y", "너비", "높이"][i]}
                  <input
                    aria-label={`${part} ${key}`}
                    type="number"
                    value={Math.round(layout[key])}
                    onChange={(e) =>
                      style(
                        `${part}Box` as keyof Style,
                        clampBox({
                          ...layout,
                          [key]: Number(e.target.value),
                        }) as never,
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <button
              className="quiet wide"
              onClick={() =>
                style(
                  `${part}Box` as keyof Style,
                  structuredClone(
                    defaultStyle[`${part}Box` as "lyricsBox"],
                  ) as never,
                )
              }
            >
              <RotateCcw size={14} />
              기본 배치
            </button>
          </details>
        )}
        {validation && json === null && (
          <p className="error" role="alert">
            {validation}
          </p>
        )}
      </div>
      {json !== null && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="가사 JSON 가져오기"
          >
            <h2>가사 JSON 가져오기</h2>
            <p>시작·종료 시간은 초 단위입니다. 기존 가사를 대체합니다.</p>
            <textarea
              className="json-input"
              aria-label="가사 JSON"
              value={json}
              onChange={(e) => setJson(e.target.value)}
            />
            {validation && (
              <p role="alert" className="error">
                {validation}
              </p>
            )}
            <div className="actions">
              <button
                onClick={() => {
                  setJson(null);
                  setValidation("");
                }}
              >
                취소
              </button>
              <button className="primary" onClick={applyJson}>
                적용
              </button>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
