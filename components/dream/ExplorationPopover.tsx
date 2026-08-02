"use client";

// ===== 点击识别浮窗 =====
// 点击画面后立即显示，等待 VLM 识别，展示裁剪预览 + "往里看看" 主操作

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ExplorationPopoverProps {
  /** 触发位置（视口坐标） */
  position: { x: number; y: number };
  /** 识别出的元素名（null 表示仍在识别中） */
  element: string | null;
  /** 元素描述 */
  description?: string;
  /** 裁剪预览 data URL */
  cropPreviewUrl?: string | null;
  /** 正在识别中 */
  identifying?: boolean;
  onExplore: (userHint: string) => void;
  onCancel: () => void;
}

export function ExplorationPopover({
  position,
  element,
  description,
  cropPreviewUrl,
  identifying = false,
  onExplore,
  onCancel,
}: ExplorationPopoverProps) {
  const [hint, setHint] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // 视口碰撞：靠近边缘自动翻转
  const [offset, setOffset] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  useEffect(() => {
    const W = typeof window !== "undefined" ? window.innerWidth : 1024;
    const H = typeof window !== "undefined" ? window.innerHeight : 768;
    const BW = 320;
    const BH = 220;
    let left = position.x + 12;
    let top = position.y - BH / 2;
    if (left + BW > W) left = position.x - BW - 12;
    if (top < 8) top = 8;
    if (top + BH > H) top = H - BH - 8;
    setOffset({ left, top });
  }, [position.x, position.y]);

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="元素识别浮窗"
      data-testid="exploration-popover"
      style={{
        position: "fixed",
        left: offset.left,
        top: offset.top,
        width: 320,
      }}
      className="z-50 glass-overlay rounded-xl p-3 fade-in-up"
    >
      <div className="flex items-start gap-2 mb-2">
        {cropPreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cropPreviewUrl}
            alt="裁剪预览"
            className="w-16 h-16 rounded-md object-cover border border-[color:var(--border)]"
          />
        ) : (
          <div className="w-16 h-16 rounded-md border border-[color:var(--border)] flex items-center justify-center text-xs text-[color:var(--foreground-subtle)]">
            预览
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] tracking-widest text-[color:var(--foreground-subtle)] mb-0.5">
            元素识别
          </p>
          {identifying ? (
            <p className="text-sm text-[color:var(--lavender-bright)]">正在看看这里…</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-[color:var(--foreground)] truncate">
                {element || "未知"}
              </p>
              {description && (
                <p className="text-xs text-[color:var(--foreground-subtle)] mt-0.5 line-clamp-2">
                  {description}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <input
        type="text"
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        placeholder="可选：补充你想看的方向"
        className="w-full px-2 py-1.5 text-xs rounded-md border border-[color:var(--border)] bg-[color:var(--background)] mb-2"
        aria-label="探索方向补充"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onExplore(hint.trim())}
          disabled={identifying || !element}
          className="flex-1 px-3 py-1.5 text-xs rounded-md border border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)] hover:bg-[color:var(--lavender)] hover:text-[color:var(--background)] transition-colors disabled:opacity-50"
        >
          往里看看！
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs rounded-md border border-[color:var(--border)] text-[color:var(--foreground-subtle)] hover:border-[color:var(--border-hover)] hover:text-[color:var(--foreground)] transition-colors"
        >
          取消
        </button>
      </div>
    </div>,
    document.body
  );
}