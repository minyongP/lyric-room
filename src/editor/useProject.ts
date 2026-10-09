import { useState, useEffect, useRef } from "react";
import { api, upload } from "./api";
import type { Project } from "../shared/project";
export function useProject() {
  const [project, setProject] = useState<Project | null>(null),
    [saved, setSaved] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [recent, setRecent] = useState<
      { id: string; title: string; artist: string }[]
    >([]);
  const generation = useRef(0);
  const dirty = !!project && JSON.stringify(project) !== saved;
  async function refresh() {
    setRecent(await api("/projects"));
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  async function open(id: string) {
    const ticket = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const p = await api<Project>("/projects/" + id);
      if (ticket === generation.current) {
        setProject(p);
        setSaved(JSON.stringify(p));
      }
    } catch (e) {
      if (ticket === generation.current) setError((e as Error).message);
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }
  async function importAudio(file: File) {
    const ticket = ++generation.current;
    setBusy(true);
    setError("");
    try {
      let p = await api<Project>("/projects", { method: "POST" });
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
        setProject(p);
        setSaved(JSON.stringify(p));
        await refresh();
      }
    } catch (e) {
      if (ticket === generation.current) setError((e as Error).message);
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }
  async function save() {
    if (!project) return;
    await api("/projects/" + project.id, {
      method: "PUT",
      body: JSON.stringify(project),
    });
    setSaved(JSON.stringify(project));
    await refresh();
  }
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
  };
}
