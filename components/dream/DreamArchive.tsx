"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  deleteProject,
  listProjects,
  saveProject,
  validateProject,
  type DreamProject,
} from "@/lib/project-storage";

interface DreamArchiveProps {
  currentProjectId: string;
  onOpenProject: (id: string) => void;
  onCreateProject: () => void;
  onClose: () => void;
}

export function DreamArchive({ currentProjectId, onOpenProject, onCreateProject, onClose }: DreamArchiveProps) {
  const [projects, setProjects] = useState<DreamProject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch {
      setError("档案馆加载失败，请稍后重试");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const exportProject = (project: DreamProject) => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.title || "oneira-dream"}.oneira.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renameProject = async (project: DreamProject) => {
    const nextTitle = window.prompt("给这个梦境一个名字", project.title);
    if (!nextTitle?.trim()) return;
    await saveProject({ ...project, title: nextTitle.trim().slice(0, 80), updatedAt: new Date().toISOString() });
    await refresh();
  };

  const removeProject = async (project: DreamProject) => {
    if (!window.confirm(`删除「${project.title}」？此操作不可撤销。`)) return;
    await deleteProject(project.id);
    if (project.id === currentProjectId) {
      localStorage.removeItem("oneira-active-project-id");
      window.location.reload();
      return;
    }
    await refresh();
  };

  const importProject = async (file: File) => {
    try {
      const parsed = validateProject(JSON.parse(await file.text()));
      if (!parsed) throw new Error("文件不是有效的 AI梦境还原器 档案");
      const imported = { ...parsed, id: `${parsed.id}-imported-${Date.now()}`, updatedAt: new Date().toISOString() };
      await saveProject(imported);
      await refresh();
      onOpenProject(imported.id);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "导入失败");
    }
  };

  return (
    <Modal open onClose={onClose} title="梦境档案馆" maxWidth="max-w-2xl">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onCreateProject} className="rounded-md border border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] px-3 py-1.5 text-xs text-[color:var(--lavender-bright)]">+ 新梦境</button>
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-md border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--foreground-muted)]">导入档案</button>
          <input ref={fileRef} type="file" accept="application/json,.json,.oneira.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importProject(file); event.currentTarget.value = ""; }} />
        </div>
        {error && <p role="alert" className="rounded-md border border-[color:var(--error)] bg-[color:var(--error-soft)] px-3 py-2 text-xs text-[color:var(--error)]">{error}</p>}
        {projects.length === 0 ? <p className="rounded-lg border border-dashed border-[color:var(--border)] p-5 text-sm text-[color:var(--foreground-subtle)]">还没有保存的梦境。</p> : (
          <div className="space-y-2">
            {projects.map((project) => (
              <article key={project.id} className={`rounded-lg border p-3 ${project.id === currentProjectId ? "border-[color:var(--lavender)] bg-[color:var(--lavender-soft)]" : "border-[color:var(--border)]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => onOpenProject(project.id)} className="min-w-0 flex-1 text-left">
                    <h3 className="truncate text-sm font-medium">{project.title || "未命名梦境"}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-[color:var(--foreground-subtle)]">{project.originalDescription || "尚未描述"}</p>
                    <p className="mt-1 text-[10px] text-[color:var(--foreground-subtle)]">{Object.keys(project.nodes).length} 个画面 · {new Date(project.updatedAt).toLocaleString()}</p>
                  </button>
                  <div className="flex shrink-0 gap-1"><button type="button" onClick={() => void renameProject(project)} className="rounded border border-[color:var(--border)] px-2 py-1 text-[10px]">重命名</button><button type="button" onClick={() => exportProject(project)} className="rounded border border-[color:var(--border)] px-2 py-1 text-[10px]">导出</button><button type="button" onClick={() => void removeProject(project)} className="rounded border border-[color:var(--error)] px-2 py-1 text-[10px] text-[color:var(--error)]">删除</button></div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}