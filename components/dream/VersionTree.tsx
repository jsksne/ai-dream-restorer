"use client";

// ===== Oneira 版本树组件（v2 重构版） =====
// 底部 40px 迷你缩略图条：
//   - 横向一维时间轴，每个版本一个 40×40 圆角缩略图
//   - hover 放大显示版本信息浮层（第 N 版 / 描述 / 语义标签）
//   - 点击切换版本（双图交叉淡入由 DreamCanvas 负责）
//   - 当前版本高亮（lavender 边框 + 发光）
//   - 已标记分析对象版本带 ✦ 徽标
//   - 每个缩略图下方有"开始分析"按钮（hover 时显示）
//
// 无 Radix / 无 sakura

import { useRef, useState, useCallback } from "react";
import type { VersionNode } from "@/types";

interface VersionTreeProps {
  /** 全部版本节点（按时间顺序） */
  versions: VersionNode[];
  /** 当前选中版本 ID */
  currentVersionId: string | null;
  /** 已标记为分析对象的版本 ID */
  analysisTargetId: string | null;
  /** 切换版本回调 */
  onSelect: (versionId: string) => void;
  /** 标记分析对象回调 */
  onAnalyze: (versionId: string) => void;
}

interface HoverInfo {
  versionId: string;
  /** 浮层 left 坐标（相对容器，px） */
  left: number;
  /** 容器宽度（在 mouseEnter 时一次性读取，避免 render 中访问 ref） */
  containerWidth: number;
}

const THUMB_SIZE = 40; // 40×40 缩略图
const THUMB_GAP = 8;   // 缩略图间距

export function VersionTree({
  versions,
  currentVersionId,
  analysisTargetId,
  onSelect,
  onAnalyze,
}: VersionTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const handleMouseEnter = useCallback((versionId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const container = containerRef.current;
    if (!container) return;
    const btnRect = btn.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setHover({
      versionId,
      left: btnRect.left - containerRect.left + btnRect.width / 2,
      containerWidth: containerRect.width,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHover(null);
  }, []);

  if (versions.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-[color:var(--foreground-subtle)] tracking-wide">
        暂无版本，开始生成第一幅梦境画面
      </div>
    );
  }

  const hoverVersion = hover ? versions.find((v) => v.id === hover.versionId) ?? null : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-x-auto overflow-y-visible"
      role="list"
      aria-label="版本树"
    >
      <div
        className="flex items-center gap-2 px-2 py-1 min-w-min h-full"
        style={{ minWidth: versions.length * (THUMB_SIZE + THUMB_GAP) + THUMB_GAP }}
      >
        {versions.map((v, idx) => {
          const isCurrent = v.id === currentVersionId;
          const isAnalysisTarget = v.id === analysisTargetId;
          return (
            <div key={v.id} className="flex items-center shrink-0" role="listitem">
              <button
                type="button"
                data-version-id={v.id}
                onMouseEnter={(e) => handleMouseEnter(v.id, e)}
                onMouseLeave={handleMouseLeave}
                onClick={() => onSelect(v.id)}
                aria-label={`第${idx + 1}版：${v.prompt}`}
                title={`第${idx + 1}版`}
                className={`relative rounded-md overflow-hidden border transition-all duration-200 cursor-pointer ${
                  isCurrent
                    ? "border-[color:var(--lavender)] shadow-[0_0_12px_var(--lavender-glow)] scale-105"
                    : "border-[color:var(--border)] hover:border-[color:var(--lavender)] hover:scale-105"
                }`}
                style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                />
                {/* 已标记分析对象徽标 */}
                {isAnalysisTarget && (
                  <span
                    className="absolute top-0 right-0 text-[8px] leading-none px-0.5 rounded-bl bg-[color:var(--lavender)] text-[color:var(--background)]"
                    aria-hidden
                  >
                    ✦
                  </span>
                )}
                {/* 版本序号（左下角小数字） */}
                <span
                  className="absolute bottom-0 left-0 text-[8px] leading-none px-1 py-0.5 bg-black/50 text-[color:var(--foreground-muted)]"
                  aria-hidden
                >
                  {idx + 1}
                </span>
              </button>

              {/* 连线（最后一个节点不渲染） */}
              {idx < versions.length - 1 && (
                <div
                  data-connector
                  aria-hidden="true"
                  className="self-center h-px w-3 bg-gradient-to-r from-[color:var(--lavender)] to-[color:var(--violet-deep)] mx-0.5"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* hover 浮层：显示版本详情 + 分析按钮 */}
      {hover && hoverVersion && (
        <div
          role="tooltip"
          className="tooltip-in glass-overlay px-3 py-2.5 w-64 pointer-events-auto"
          style={{
            left: Math.max(8, Math.min(hover.left - 128, hover.containerWidth - 264)),
            top: -160,
            position: "absolute",
            zIndex: 9999,
          }}
        >
          {/* 头部：第 N 版 + 标记状态 */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] tracking-widest text-[color:var(--foreground-subtle)]">
              第 {versions.findIndex((v) => v.id === hover.versionId) + 1} 版
            </span>
            {hoverVersion.id === analysisTargetId && (
              <span className="text-[10px] tracking-widest text-[color:var(--lavender-bright)]">
                ✦ 已标记分析
              </span>
            )}
          </div>

          {/* 缩略图 + 描述 */}
          <div className="flex gap-2 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hoverVersion.imageUrl}
              alt=""
              className="w-14 h-14 rounded-md object-cover border border-[color:var(--border)] shrink-0"
              draggable={false}
            />
            <div className="flex-1 min-w-0">
              <p
                className="text-xs text-[color:var(--foreground)] line-clamp-3 leading-relaxed"
                title={hoverVersion.prompt}
              >
                {hoverVersion.prompt}
              </p>
            </div>
          </div>

          {/* 语义标签 */}
          <div className="flex flex-wrap gap-1 mb-2">
            <span className="tag-chip">{hoverVersion.semanticTags.scene}</span>
            <span className="tag-chip">{hoverVersion.semanticTags.emotion}</span>
          </div>

          {/* 分析按钮 */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAnalyze(hoverVersion.id);
              setHover(null);
            }}
            className={`w-full text-xs px-2 py-1 rounded-md border transition-colors ${
              hoverVersion.id === analysisTargetId
                ? "border-[color:var(--lavender)] text-[color:var(--lavender-bright)] bg-[color:var(--lavender-soft)]"
                : "border-[color:var(--border)] text-[color:var(--foreground-muted)] hover:border-[color:var(--lavender)] hover:text-[color:var(--lavender-bright)]"
            }`}
          >
            {hoverVersion.id === analysisTargetId ? "重新分析" : "开始分析"}
          </button>
        </div>
      )}
    </div>
  );
}
