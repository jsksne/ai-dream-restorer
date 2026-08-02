"use client";

// ===== BranchPicker：节点分支选择器 =====
// 当节点 childIds.length > 1 时显示，点击徽标打开

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { DreamNode } from "@/lib/project-storage";

interface BranchPickerProps {
  node: DreamNode;
  branches: DreamNode[];
  activeChildId: string | null;
  onSelect: (childId: string) => void;
  onClose: () => void;
}

export function BranchPicker({ node, branches, activeChildId, onSelect, onClose }: BranchPickerProps) {
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  useEffect(() => {
    const W = typeof window !== "undefined" ? window.innerWidth : 1024;
    const H = typeof window !== "undefined" ? window.innerHeight : 768;
    const BW = 360;
    const BH = 240;
    const left = Math.max(8, Math.min(W - BW - 8, 100));
    const top = Math.max(8, Math.min(H - BH - 8, 100));
    setPos({ left, top });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  if (branches.length <= 1) return null;

  return createPortal(
    <div
      role="dialog"
      aria-label={`节点 ${node.branchLabel} 的分支`}
      data-testid="branch-picker"
      style={{ position: "fixed", left: pos.left, top: pos.top, width: 360 }}
      className="z-50 glass-overlay rounded-xl p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs tracking-widest text-[color:var(--foreground-subtle)]">
          分支选择 · {node.branchLabel} · {branches.length}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭分支选择"
          className="opacity-60 hover:opacity-100"
        >
          ×
        </button>
      </div>
      <ul className="space-y-2 max-h-72 overflow-auto">
        {branches.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={c.id === activeChildId ? "true" : undefined}
              className={`w-full text-left px-2 py-2 rounded-md flex items-center gap-2 border transition-colors ${
                c.id === activeChildId
                  ? "border-[color:var(--lavender)] bg-[color:var(--lavender-soft)]"
                  : "border-[color:var(--border)] hover:border-[color:var(--lavender)]"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/assets/${c.assetId}`}
                alt=""
                className="w-10 h-10 rounded object-cover bg-[color:var(--border)]"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">{c.branchLabel}</p>
                <p className="text-[10px] text-[color:var(--foreground-subtle)]">
                  {new Date(c.createdAt).toLocaleString("zh-CN")}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>,
    document.body
  );
}