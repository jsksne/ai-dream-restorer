"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { generateId } from "@/lib/utils";
import {
  deleteProfile,
  listProfiles,
  saveProfile,
  type DreamSelfProfile,
} from "@/lib/project-storage";
import { validateDreamSelfInput } from "@/lib/dream-self";

interface DreamSelfManagerProps {
  activeProfileId: string | null;
  onSelect: (profileId: string | null) => void;
  onClose: () => void;
}

export function DreamSelfManager({ activeProfileId, onSelect, onClose }: DreamSelfManagerProps) {
  const [profiles, setProfiles] = useState<DreamSelfProfile[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [traits, setTraits] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setProfiles(await listProfiles());
    } catch {
      setError("档案加载失败，请稍后重试");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createProfile = async () => {
    const result = validateDreamSelfInput({
      name,
      description,
      signatureTraits: traits.split(/[，,]/).map((item) => item.trim()).filter(Boolean),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const now = new Date().toISOString();
    const profile: DreamSelfProfile = {
      id: generateId(),
      name: result.profile.name as string,
      description: result.profile.description as string,
      referenceAssetId: null,
      canonicalAssetId: "text-only",
      signatureTraits: result.profile.signatureTraits as string[],
      approvedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await saveProfile(profile);
    setName("");
    setDescription("");
    setTraits("");
    setCreating(false);
    setError(null);
    await refresh();
  };

  const removeProfile = async (profile: DreamSelfProfile) => {
    if (!window.confirm(`删除 Dream Self「${profile.name}」？`)) return;
    await deleteProfile(profile.id);
    if (activeProfileId === profile.id) onSelect(null);
    await refresh();
  };

  return (
    <Modal open onClose={onClose} title="Dream Self" maxWidth="max-w-lg">
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-[color:var(--foreground-subtle)]">
          Dream Self 只保存你确认过的文字特征；首次人称生成不会上传形象图片。每个梦境同时只启用一份档案。
        </p>
        {error && <p role="alert" className="rounded-md border border-[color:var(--error)] bg-[color:var(--error-soft)] px-3 py-2 text-xs text-[color:var(--error)]">{error}</p>}
        {profiles.length === 0 && !creating && (
          <p className="rounded-lg border border-dashed border-[color:var(--border)] p-4 text-sm text-[color:var(--foreground-subtle)]">还没有 Dream Self 档案。</p>
        )}
        <div className="space-y-2">
          {profiles.map((profile) => (
            <article key={profile.id} className={`rounded-lg border p-3 ${profile.id === activeProfileId ? "border-[color:var(--lavender)] bg-[color:var(--lavender-soft)]" : "border-[color:var(--border)]"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium">{profile.name}</h3>
                  <p className="mt-1 text-xs text-[color:var(--foreground-muted)]">{profile.description || "未填写描述"}</p>
                  {profile.signatureTraits.length > 0 && <p className="mt-1 text-[10px] text-[color:var(--foreground-subtle)]">特征：{profile.signatureTraits.join("、")}</p>}
                </div>
                <span className="shrink-0 text-[10px] text-[color:var(--foreground-subtle)]">{profile.id === activeProfileId ? "当前使用" : "未启用"}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => onSelect(profile.id === activeProfileId ? null : profile.id)} className="rounded-md border border-[color:var(--lavender)] px-2.5 py-1 text-xs text-[color:var(--lavender-bright)]">{profile.id === activeProfileId ? "停用" : "用于这个梦"}</button>
                <button type="button" onClick={() => void removeProfile(profile)} className="rounded-md border border-[color:var(--border)] px-2.5 py-1 text-xs text-[color:var(--foreground-subtle)]">删除</button>
              </div>
            </article>
          ))}
        </div>
        {creating ? (
          <div className="space-y-2 rounded-lg border border-[color:var(--border)] p-3">
            <input aria-label="档案名称" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：平时的我" className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-2 py-1.5 text-sm" />
            <textarea aria-label="档案描述" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="描述你希望在梦里保持的身份感" rows={2} className="w-full resize-none rounded-md border border-[color:var(--border)] bg-transparent px-2 py-1.5 text-sm" />
            <input aria-label="标志性特征" value={traits} onChange={(event) => setTraits(event.target.value)} placeholder="标志性特征，用逗号分隔" className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-2 py-1.5 text-sm" />
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setCreating(false)} className="rounded-md border border-[color:var(--border)] px-3 py-1.5 text-xs">取消</button><button type="button" onClick={() => void createProfile()} className="rounded-md border border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] px-3 py-1.5 text-xs text-[color:var(--lavender-bright)]">确认档案</button></div>
          </div>
        ) : (
          <button type="button" onClick={() => setCreating(true)} className="w-full rounded-lg border border-dashed border-[color:var(--lavender)] px-3 py-2 text-sm text-[color:var(--lavender-bright)]">+ 新建 Dream Self</button>
        )}
      </div>
    </Modal>
  );
}