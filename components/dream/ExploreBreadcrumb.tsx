"use client";

// ===== Oneira 探索面包屑组件（v2 重构版） =====
// 顶部半透明面包屑：[版本] › [探索1] › [探索2] › ...
//   - 点击版本节点 → onReset（回到版本本身）
//   - 点击历史探索节点 → onSelect(index)
//   - 探索中（currentIndex >= 0）展示「存为新版本」按钮
//   - 当前位置高亮（lavender 边框 + 发光）
//
// 无 Radix / 无 sakura

import type { ExploreNode, VersionNode } from "@/types";

interface ExploreBreadcrumbProps {
  /** 探索起点的版本节点 */
  baseVersion: VersionNode;
  /** 探索路径（按时间顺序，索引 0 为最早一次探索） */
  explorePath: ExploreNode[];
  /** 当前探索位置索引；-1 表示回到版本本身（无探索激活） */
  currentIndex: number;
  /** 点击历史探索节点回调，传入节点在 explorePath 中的索引 */
  onSelect: (index: number) => void;
  /** 点击「存为新版本」回调 */
  onSaveAsVersion: () => void;
  /** 点击版本节点回调（回到版本本身，重置探索） */
  onReset: () => void;
}

export function ExploreBreadcrumb({
  baseVersion,
  explorePath,
  currentIndex,
  onSelect,
  onSaveAsVersion,
  onReset,
}: ExploreBreadcrumbProps) {
  return (
    <div
      className="w-full h-full overflow-x-auto overflow-y-hidden"
      role="list"
      aria-label="探索路径面包屑"
    >
      <div className="flex items-center gap-1 px-2 py-1 min-w-min h-full">
        {/* 版本节点（探索起点） */}
        <button
          type="button"
          role="listitem"
          onClick={onReset}
          title={baseVersion.prompt}
          aria-label={`回到版本：${baseVersion.prompt}`}
          className={`shrink-0 px-2.5 py-1 rounded-md text-xs border transition-all duration-200 max-w-[160px] truncate ${
            currentIndex === -1
              ? "border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)] shadow-[0_0_12px_var(--lavender-glow)]"
              : "border-[color:var(--border)] bg-[color:var(--background-card)]/60 text-[color:var(--foreground-muted)] hover:border-[color:var(--border-hover)] hover:text-[color:var(--foreground)]"
          }`}
        >
          <span className="truncate inline-block align-middle">
            {baseVersion.prompt}
          </span>
        </button>

        {/* 探索节点列表 */}
        {explorePath.map((node, idx) => (
          <div key={node.id} className="flex items-center gap-1 shrink-0">
            {/* 分隔符 */}
            <span
              data-separator
              aria-hidden="true"
              className="text-[color:var(--foreground-subtle)] text-xs select-none"
            >
              ›
            </span>

            {/* 探索节点 */}
            <button
              type="button"
              role="listitem"
              data-explore-id={node.id}
              onClick={() => onSelect(idx)}
              title={node.explorePrompt}
              aria-label={`跳转到探索：${node.element}`}
              className={`shrink-0 px-2.5 py-1 rounded-md text-xs border transition-all duration-200 max-w-[140px] truncate ${
                idx === currentIndex
                  ? "border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)] shadow-[0_0_12px_var(--lavender-glow)]"
                  : "border-[color:var(--border)] bg-[color:var(--background-card)]/60 text-[color:var(--foreground-muted)] hover:border-[color:var(--border-hover)] hover:text-[color:var(--foreground)]"
              }`}
            >
              <span className="truncate inline-block align-middle">
                {node.element}
              </span>
            </button>
          </div>
        ))}

        {/* 「存为新版本」按钮：仅在探索中（currentIndex >= 0）显示 */}
        {currentIndex >= 0 && (
          <button
            type="button"
            onClick={onSaveAsVersion}
            className="shrink-0 ml-2 px-2.5 py-1 rounded-md text-xs border border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)] hover:bg-[color:var(--lavender)] hover:text-[color:var(--background)] transition-colors"
          >
            存为新版本
          </button>
        )}
      </div>
    </div>
  );
}
