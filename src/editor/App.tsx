import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Save,
  ArrowUpRight,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FolderOpen,
  Volume2,
  RotateCcw,
  Maximize,
  ChevronDown,
} from "lucide-react";
import { useProject } from "./useProject";
import { api, upload } from "./api";
import { Inspector, parts } from "./Inspector";
import { Preview } from "./Preview";
import type { Box, ExportJob, Part, Style } from "../shared/project";
import { formatTime } from "../shared/project";
import { parseLyrics } from "../shared/lyrics";
import { assetUrl, loadFonts } from "../scene/media";
import { findOverflowCues, playerForeground } from "../scene/draw";
import { emptySpectrum, type Spectrum } from "../audio/spectrum";
export default function App() {
  const state = useProject(),
    p = state.project;
  const [part, setPart] = useState<Part>("lyrics"),
    [menu, setMenu] = useState(false),
    [playMode, setPlayMode] = useState(false),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [volume, setVolume] = useState(0.7),
    [message, setMessage] = useState(""),
    [spectrum, setSpectrum] = useState<Spectrum>(emptySpectrum),
    [analyzing, setAnalyzing] = useState(false),
    [job, setJob] = useState<ExportJob | null>(null),
    [health, setHealth] = useState<{
      ffmpeg: boolean;
      chromium: boolean;
      error?: string;
    } | null>(null),
    [pending, setPending] = useState<(() => void) | null>(null),
    [overflow, setOverflow] = useState<number[]>([]);
  const audio = useRef<HTMLAudioElement>(null),
    audioInput = useRef<HTMLInputElement>(null),
    projectRef = useRef(p),
    changeVersion = useRef(0),
    assetVersions = useRef({ background: 0, cover: 0 }),
    pendingAssets = useRef(new Set<symbol>());
  const [assetBusy, setAssetBusy] = useState(false);
  const busy = state.busy || assetBusy;
  projectRef.current = p;
  useEffect(() => {
    api<typeof health>("/health")
      .then(setHealth)
      .catch((e) => state.setError(e.message));
  }, []);
  useEffect(() => {
    setTime(0);
    setPlaying(false);
    setSpectrum(emptySpectrum);
    setOverflow([]);
    changeVersion.current++;
    pendingAssets.current.clear();
    setAssetBusy(false);
    if (!p?.audioId) return;
    let cancelled = false;
    setAnalyzing(true);
    api<Spectrum>(`/projects/${p.id}/analysis/${p.audioId}`)
      .then((s) => {
        if (!cancelled) setSpectrum(s);
      })
      .catch((e) => {
        if (!cancelled) state.setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setAnalyzing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [p?.id, p?.audioId]);
  useEffect(() => {
    if (!job || !["queued", "rendering", "encoding"].includes(job.status))
      return;
    let gone = false;
    const id = setInterval(
      () =>
        api<ExportJob>("/exports/" + job.id)
          .then((j) => {
            if (!gone) setJob(j);
          })
          .catch((e) => {
            if (!gone) state.setError(e.message);
          }),
      700,
    );
    return () => {
      gone = true;
      clearInterval(id);
    };
  }, [job?.id, job?.status]);
  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const tick = () => {
      setTime(audio.current?.currentTime || 0);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);
  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume, p?.id]);
  function notify(s: string) {
    setMessage(s);
  }
  function stop() {
    audio.current?.pause();
    setPlaying(false);
  }
  const switchAttempt = useRef(0);
  async function guard(action: () => void) {
    const attempt = ++switchAttempt.current;
    stop();
    setMenu(false);
    try {
      if (state.dirty) await state.save();
      if (attempt === switchAttempt.current) action();
    } catch {
      if (attempt === switchAttempt.current) setPending(() => action);
    }
  }
  async function save() {
    try {
      if (p) {
        const r = parseLyrics({ lyrics: p.lyrics }, p.duration);
        if (!r.ok)
          throw Error(
            r.errors.map((e) => `${e.cue}행: ${e.message}`).join("\n"),
          );
      }
      await state.save();
      notify("저장했습니다.");
    } catch (e) {
      state.setError((e as Error).message);
      throw e;
    }
  }
  function seek(t: number) {
    if (audio.current) {
      audio.current.currentTime = t;
      setTime(t);
    }
  }
  async function togglePlay() {
    if (!audio.current) return;
    if (playing) stop();
    else
      try {
        await audio.current.play();
        setPlaying(true);
      } catch {
        state.setError("음원을 재생할 수 없습니다. 다시 열어 주세요.");
      }
  }
  async function asset(file: File, role: "background" | "cover") {
    if (!p) return;
    const id = p.id,
      projectVersion = changeVersion.current,
      version = ++assetVersions.current[role],
      ticket = Symbol();
    const current = () =>
      projectRef.current?.id === id &&
      projectVersion === changeVersion.current &&
      version === assetVersions.current[role];
    pendingAssets.current.add(ticket);
    setAssetBusy(true);
    try {
      const item = await upload(id, file, role);
      if (current())
        state.update(
          role === "cover" ? { coverId: item.id } : { backgroundId: item.id },
        );
    } catch (e) {
      if (current()) state.setError((e as Error).message);
    } finally {
      pendingAssets.current.delete(ticket);
      setAssetBusy(pendingAssets.current.size > 0);
    }
  }
  function removeAsset(role: "background" | "cover") {
    assetVersions.current[role]++;
    state.update(
      role === "cover" ? { coverId: undefined } : { backgroundId: undefined },
    );
  }

  function box(part: Part, b: Box) {
    state.setProject((previous) =>
      previous
        ? { ...previous, style: { ...previous.style, [part + "Box"]: b } }
        : null,
    );
  }
  async function exportVideo() {
    if (!p) return;
    try {
      const valid = parseLyrics({ lyrics: p.lyrics }, p.duration);
      if (!valid.ok) throw Error("가사 시간을 확인한 뒤 내보내 주세요.");
      await loadFonts(p);
      const canvas = document.createElement("canvas");
      const overflowing = findOverflowCues(canvas.getContext("2d")!, p);
      if (
        overflowing.length &&
        !window.confirm(
          `구절 ${overflowing.map((i) => i + 1).join(", ")}의 가사가 잘릴 수 있습니다. 글자 크기나 패널을 조절해 주세요. 계속할까요?`,
        )
      )
        return;
      setJob(
        await api<ExportJob>("/exports", {
          method: "POST",
          body: JSON.stringify(p),
        }),
      );
    } catch (e) {
      state.setError((e as Error).message);
    }
  }
  const activeJob =
    job && ["queued", "rendering", "encoding"].includes(job.status);
  const transport = (
    <>
      <button
        aria-label="이전 구절"
        onClick={() =>
          seek(
            [...p!.lyrics].reverse().find((c) => c.start < time - 0.2)?.start ||
              0,
          )
        }
      >
        <SkipBack size={20} />
      </button>
      <button
        className="play-button"
        aria-label={playing ? "일시정지" : "재생"}
        onClick={togglePlay}
        disabled={!p?.audioId || busy}
      >
        {playing ? <Pause size={24} /> : <Play size={24} />}
      </button>
      <button
        aria-label="다음 구절"
        onClick={() =>
          seek(p!.lyrics.find((c) => c.start > time + 0.2)?.start || 0)
        }
      >
        <SkipForward size={20} />
      </button>
    </>
  );
  return (
    <div className={"app " + (playMode ? "play-mode" : "")}>
      <input
        data-testid="audio-input"
        ref={audioInput}
        type="file"
        accept=".mp3,audio/mpeg"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) guard(() => void state.importAudio(f));
          e.target.value = "";
        }}
      />
      <header className="app-header">
        <div className="brand">
          <span>
            <AudioLines size={20} />
          </span>
          lyric room
        </div>
        <div className="file-wrap">
          <button
            className="quiet"
            aria-label="파일"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            파일
            <ChevronDown size={12} />
          </button>
          {menu && (
            <>
              <button
                className="menu-dismiss"
                aria-label="파일 메뉴 닫기"
                onClick={() => setMenu(false)}
              />
              <div className="file-menu">
                <button
                  onClick={() => {
                    setMenu(false);
                    audioInput.current?.click();
                  }}
                >
                  <FolderOpen size={15} />
                  음악 파일 열기…
                </button>
                <button
                  disabled={!p}
                  onClick={() => {
                    setMenu(false);
                    void save().catch(() => {});
                  }}
                >
                  <Save size={15} />
                  현재 프로젝트 저장
                </button>
                <small>최근 프로젝트</small>
                {state.recent.length === 0 ? (
                  <p>아직 저장한 음악이 없습니다.</p>
                ) : (
                  state.recent.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => guard(() => void state.open(r.id))}
                    >
                      {r.title || "제목 없음"}
                      {r.id === p?.id && (
                        <span className="current-tag">현재</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        <span className="document-name">
          {p ? p.title : "새 프로젝트"}
          {state.dirty ? " · 수정됨" : ""}
        </span>
        {p && (
          <span
            className={`save-status ${state.saveStatus}`}
            role="status"
            data-testid="save-status"
            title={state.saveDetail || "편집을 멈추면 로컬에 자동 저장됩니다."}
          >
            {
              {
                saved: "자동 저장됨",
                waiting: "저장 대기 중",
                saving: "저장 중…",
                error: "자동 저장 실패",
                blocked: "자동 저장 보류",
              }[state.saveStatus]
            }
          </span>
        )}
        <div className="header-actions">
          <button disabled={!p} onClick={() => setPlayMode(!playMode)}>
            <Maximize size={15} />
            {playMode ? "편집으로" : "플레이 화면"}
          </button>
          <button
            disabled={!p || busy}
            onClick={() => void save().catch(() => {})}
          >
            <Save size={15} />
            <span>저장</span>
          </button>
          <button
            className="primary"
            disabled={
              !p?.audioId ||
              busy ||
              !!activeJob ||
              !health?.ffmpeg ||
              !health?.chromium
            }
            onClick={exportVideo}
          >
            <ArrowUpRight size={16} />
            영상 내보내기
          </button>
        </div>
      </header>
      {health && (!health.ffmpeg || !health.chromium) && (
        <div className="banner error">
          {!health.ffmpeg
            ? health.error
            : "영상 출력용 Chromium을 설치해 주세요: npx playwright install chromium"}
        </div>
      )}
      {(state.error || message) && (
        <div
          className={"banner " + (state.error ? "error" : "")}
          role={state.error ? "alert" : "status"}
        >
          {state.error || message}
          <button
            aria-label="알림 닫기"
            onClick={() => {
              state.setError("");
              setMessage("");
            }}
          >
            ×
          </button>
        </div>
      )}
      {p &&
        (state.saveStatus === "error" || state.saveStatus === "blocked") && (
          <div className="banner error" role="alert">
            <span>
              {state.saveStatus === "blocked"
                ? "입력을 수정하면 자동 저장됩니다."
                : "저장하지 못했습니다. 서버 연결을 확인하고 다시 시도해 주세요."}{" "}
              {state.saveDetail}
            </span>
            {state.saveStatus === "error" && (
              <button onClick={() => void save().catch(() => {})}>
                다시 저장
              </button>
            )}
          </div>
        )}
      {busy && (
        <div className="busy-bar" role="status">
          파일 처리 중…
        </div>
      )}
      {!p ? (
        <main className="welcome">
          <div className="welcome-mark">
            <AudioLines size={42} />
          </div>
          <span className="eyebrow">YOUR MUSIC, YOUR SCENE</span>
          <h1>음악에 나만의 장면을.</h1>
          <p>한 곡을 열고, 가사를 더하고, 당신의 영상으로 만드세요.</p>
          <button
            className="primary"
            disabled={busy}
            onClick={() => audioInput.current?.click()}
          >
            <FolderOpen size={18} />
            MP3 파일 열기
          </button>
          <small>내 컴퓨터에서 편집하고 저장합니다.</small>
          {state.recent.length > 0 && (
            <section className="recent">
              <h3>이어서 편집하기</h3>
              {state.recent.slice(0, 4).map((r) => (
                <button key={r.id} onClick={() => void state.open(r.id)}>
                  <AudioLines size={15} />
                  {r.title}
                  <span>{r.artist}</span>
                </button>
              ))}
            </section>
          )}
        </main>
      ) : (
        <>
          <audio
            ref={audio}
            src={p.audioId ? assetUrl(p, p.audioId) : undefined}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
            onEnded={() => setPlaying(false)}
            onTimeUpdate={() => {
              if (!playing) setTime(audio.current?.currentTime || 0);
            }}
            onError={() =>
              state.setError(
                "음원을 읽을 수 없습니다. 파일을 다시 열어 주세요.",
              )
            }
          />
          <div className="workspace">
            {!playMode && (
              <nav className="toolrail" aria-label="편집 도구">
                {parts.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    aria-label={label + " 편집"}
                    aria-pressed={part === id}
                    onClick={() => setPart(id)}
                  >
                    <Icon size={20} />
                    <span>{label}</span>
                  </button>
                ))}
              </nav>
            )}
            <main className="stage">
              <div className="stage-heading">
                <span>{playMode ? "NOW PLAYING" : "영상 미리보기"}</span>
                <span>16:9 · 1080p{analyzing ? " · 음원 분석 중" : ""}</span>
              </div>
              <div className="canvas-shell">
                <Preview
                  project={p}
                  time={time}
                  spectrum={spectrum}
                  selected={part}
                  onSelect={setPart}
                  onBox={box}
                  onError={state.setError}
                  onOverflow={setOverflow}
                  playMode={playMode}
                />
                {p.style.showControls && (
                  <div
                    className="scene-controls"
                    role="group"
                    aria-label="화면 내 재생 조작"
                    style={{
                      color: playerForeground(p.style.playerColor),
                      left:
                        (p.style.playerBox.x + p.style.playerBox.w * 0.67) /
                          19.2 +
                        "%",
                      top:
                        (p.style.playerBox.y + p.style.playerBox.h * 0.32) /
                          10.8 +
                        "%",
                    }}
                  >
                    {transport}
                  </div>
                )}
              </div>
              {overflow.length > 0 && (
                <p className="warning">
                  구절 {overflow.map((i) => i + 1).join(", ")}이 패널보다
                  큽니다. 글자 크기나 패널 크기를 조절해 주세요.
                </p>
              )}
              <div className="transport">
                <div className="transport-buttons">{transport}</div>
                <label className="volume">
                  <Volume2 size={16} />
                  <input
                    aria-label="볼륨"
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    value={volume}
                    onChange={(e) => setVolume(+e.target.value)}
                  />
                </label>
              </div>
              <div className="seek-row">
                <time>{formatTime(time)}</time>
                <input
                  aria-label="재생 위치"
                  type="range"
                  min="0"
                  max={p.duration || 1}
                  step=".01"
                  value={time}
                  onChange={(e) => seek(Number(e.target.value))}
                />
                <time>{formatTime(p.duration)}</time>
              </div>
              {!playMode && (
                <section className="timeline">
                  <header>
                    <span>가사 타임라인</span>
                    <small>{p.lyrics.length} 구절 · 요소를 드래그해 배치</small>
                  </header>
                  <div className="timeline-cues">
                    {p.lyrics.length ? (
                      p.lyrics.map((c, i) => (
                        <button
                          key={i}
                          className={
                            time >= c.start && time < c.end ? "active" : ""
                          }
                          onClick={() => seek(c.start)}
                          style={{ flex: Math.max(1, c.end - c.start) }}
                        >
                          <span>{formatTime(c.start)}</span>
                          {c.original}
                        </button>
                      ))
                    ) : (
                      <button
                        className="empty-timeline"
                        onClick={() => setPart("lyrics")}
                      >
                        가사를 추가하면 시간에 맞춰 자동으로 넘어갑니다.
                      </button>
                    )}
                  </div>
                </section>
              )}
            </main>
            {!playMode && (
              <Inspector
                key={p.id}
                p={p}
                part={part}
                update={state.update}
                onAsset={asset}
                onRemoveAsset={removeAsset}
                onSeek={seek}
                onError={notify}
              />
            )}
          </div>
        </>
      )}
      {job && (
        <section className="export-status" role="status">
          <div>
            <strong>
              {job.status === "completed"
                ? "영상이 완성되었습니다"
                : job.status === "failed"
                  ? "내보내기 실패"
                  : job.status === "cancelled"
                    ? "내보내기 취소"
                    : job.status === "encoding"
                      ? "영상 마무리 중"
                      : "영상 만드는 중"}
            </strong>
            <span>{job.error || `${job.progress}% · MP4 / 1080p / 30fps`}</span>
          </div>
          <progress value={job.progress} max="100" />
          {activeJob ? (
            <button
              onClick={() =>
                void api<ExportJob>("/exports/" + job.id + "/cancel", {
                  method: "POST",
                })
                  .then(setJob)
                  .catch((e) => state.setError(e.message))
              }
            >
              취소
            </button>
          ) : (
            <>
              {job.downloadUrl && (
                <a className="button primary" href={job.downloadUrl}>
                  MP4 저장
                </a>
              )}
              <button aria-label="출력 상태 닫기" onClick={() => setJob(null)}>
                닫기
              </button>
            </>
          )}
        </section>
      )}
      {pending && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="변경 내용 저장"
          >
            <h2>변경 내용을 저장할까요?</h2>
            <p>
              자동 저장을 완료하지 못했습니다. 현재 편집 내용을 수정하거나
              저장을 다시 시도할 수 있어요.
            </p>
            <div className="actions">
              <button onClick={() => setPending(null)}>취소</button>
              <button
                onClick={() => {
                  const action = pending;
                  setPending(null);
                  action();
                }}
              >
                버리고 열기
              </button>
              <button
                className="primary"
                onClick={async () => {
                  try {
                    await save();
                    const action = pending;
                    setPending(null);
                    action();
                  } catch {}
                }}
              >
                저장하고 열기
              </button>
            </div>
          </section>
        </div>
      )}
      <footer className="app-footer">
        <span>
          {p?.audioId ? "LOCAL PROJECT" : "LYRIC ROOM"} · 외부 업로드 없이
        </span>
        <span>{p ? formatTime(p.duration) : "MP3 → 가사 → 영상"}</span>
      </footer>
    </div>
  );
}
