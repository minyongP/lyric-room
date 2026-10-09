import { useState, useEffect, useRef, useMemo } from "react";
import { api, upload } from "./api";
import { projectSchema, type Project } from "../shared/project";
import { applyTemplate } from "../shared/templates";
import type { TemplateId } from "../shared/template-id";
import { parseLyrics } from "../shared/lyrics";
function draftProblem(p: Project | null) {
  if (!p) return "";
  const shape = projectSchema.safeParse(p);
  if (!shape.success) return "입력한 값의 범위와 필수 항목을 확인해 주세요.";
  const lyrics = parseLyrics({ lyrics: p.lyrics }, p.duration);
  return lyrics.ok
    ? ""
    : lyrics.errors.map((e) => `${e.cue ?? ""}행: ${e.message}`).join(" ");
}
export function useProject() {
  const [project, setProject] = useState<Project | null>(null),
    [saved, setSaved] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [savingId, setSavingId] = useState<string | null>(null),
    [saveFailure, setSaveFailure] = useState<{
      snapshot: string;
      message: string;
    } | null>(null),
    [recent, setRecent] = useState<
      { id: string; title: string; artist: string }[]
    >([]);
  const generation = useRef(0),
    current = useRef(project),
    persisted = useRef(new Map<string, string>()),
    queue = useRef<Promise<void>>(Promise.resolve());
  current.current = project;
  const serialized = useMemo(
      () => (project ? JSON.stringify(project) : ""),
      [project],
    ),
    dirty = !!project && serialized !== saved,
    problem = useMemo(() => draftProblem(project), [project]);
  async function refresh() {
    setRecent(await api("/projects"));
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  function accept(p: Project) {
    const value = JSON.stringify(p);
    persisted.current.set(p.id, value);
    setProject(p);
    setSaved(value);
    setSaveFailure(null);
  }
  async function open(id: string) {
    const ticket = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const p = await api<Project>("/projects/" + id);
      if (ticket === generation.current) accept(p);
    } catch (e) {
      if (ticket === generation.current) setError((e as Error).message);
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }
  async function importAudio(file: File, templateId: TemplateId = "classic") {
    const ticket = ++generation.current;
    setBusy(true);
    setError("");
    try {
      let p = await api<Project>("/projects", { method: "POST" });
      p = applyTemplate(p, templateId);
      const asset = await upload(p.id, file, "audio");
      p = {
        ...p,
        title: file.name.replace(/\.mp3$/i, ""),
        audioId: asset.id,
        duration: asset.duration!,
      };
      await api("/projects/" + p.id, {
        method: "PUT",
        body: JSON.stringify(p),
      });
      if (ticket === generation.current) {
        accept(p);
        await refresh();
      }
    } catch (e) {
      if (ticket === generation.current) setError((e as Error).message);
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }
  function persist(snapshot: Project, value: string, ticket: number) {
    const work = queue.current
      .catch(() => {})
      .then(async () => {
        if (persisted.current.get(snapshot.id) === value) return;
        if (
          current.current?.id === snapshot.id &&
          ticket === generation.current
        )
          setSavingId(snapshot.id);
        try {
          await api("/projects/" + snapshot.id, { method: "PUT", body: value });
          persisted.current.set(snapshot.id, value);
          if (
            current.current?.id === snapshot.id &&
            ticket === generation.current
          ) {
            setSaved(value);
            setSaveFailure(null);
          }
          setRecent((rows) => [
            { id: snapshot.id, title: snapshot.title, artist: snapshot.artist },
            ...rows.filter((r) => r.id !== snapshot.id),
          ]);
        } catch (e) {
          if (
            current.current?.id === snapshot.id &&
            ticket === generation.current
          )
            setSaveFailure({ snapshot: value, message: (e as Error).message });
          throw e;
        } finally {
          setSavingId((id) => (id === snapshot.id ? null : id));
        }
      });
    queue.current = work;
    return work;
  }
  async function save() {
    const id = current.current?.id,
      ticket = generation.current;
    while (current.current?.id === id && id && ticket === generation.current) {
      const snapshot = current.current;
      if (!snapshot) return;
      const value = JSON.stringify(snapshot),
        invalid = draftProblem(snapshot);
      if (invalid) throw Error(invalid);
      await persist(snapshot, value, ticket);
      if (JSON.stringify(current.current) === value) return;
    }
  }
  useEffect(() => {
    if (!project || !dirty || busy || problem) return;
    const snapshot = project,
      value = serialized,
      ticket = generation.current;
    const timer = setTimeout(() => {
      void persist(snapshot, value, ticket).catch(() => {});
    }, 750);
    return () => clearTimeout(timer);
  }, [serialized, saved, busy, problem]);
  function update(patch: Partial<Project>) {
    setProject((p) => (p ? { ...p, ...patch } : null));
  }
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const failed =
    dirty && saveFailure?.snapshot === serialized ? saveFailure.message : "";
  const saveStatus =
    dirty && problem
      ? "blocked"
      : savingId === project?.id
        ? "saving"
        : failed
          ? "error"
          : dirty
            ? "waiting"
            : "saved";
  return {
    project,
    update,
    setProject,
    dirty,
    busy,
    error,
    setError,
    setBusy,
    save,
    open,
    importAudio,
    recent,
    saveStatus,
    saveDetail: problem || failed,
  };
}
