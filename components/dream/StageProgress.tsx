"use client";

// ===== 真实阶段进度组件 =====
// 显示 OperationEvent 阶段列表，已完成阶段打勾，当前阶段动画，未完成灰色
// 无虚假百分比

import { useMemo } from "react";
import {
  GENERATE_STAGES,
  EXPLORE_STAGES,
  ANALYZE_STAGES,
  STAGE_LABEL,
  type OperationKind,
  type OperationStage,
} from "@/lib/operations/types";

interface StageProgressProps {
  kind: OperationKind;
  stage: OperationStage | null;
  status: "idle" | "queued" | "running" | "completed" | "failed" | "cancelled";
  onCancel?: () => void;
}

export function StageProgress({ kind, stage, status, onCancel }: StageProgressProps) {
  const stages = useMemo<OperationStage[]>(() => {
    switch (kind) {
      case "generate":
        return [...GENERATE_STAGES];
      case "explore":
        return [...EXPLORE_STAGES];
      case "analyze":
        return [...ANALYZE_STAGES];
      default:
        return [];
    }
  }, [kind]);

  const currentIndex = stage ? stages.indexOf(stage) : -1;

  if (stages.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="glass-overlay rounded-xl px-4 py-3 min-w-[240px] max-w-[320px]"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs tracking-widest text-[color:var(--foreground-subtle)]">
          {status === "completed"
            ? "完成"
            : status === "failed"
              ? "失败"
              : status === "cancelled"
                ? "已取消"
                : `进行中 · ${kind}`}
        </p>
        {onCancel && status === "running" && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs px-2 py-0.5 rounded border border-[color:var(--border)] hover:border-[color:var(--lavender)]"
          >
            取消
          </button>
        )}
      </div>
      <ol className="space-y-1.5">
        {stages.map((s, i) => {
          const isDone = i < currentIndex || status === "completed";
          const isCurrent = i === currentIndex && status === "running";
          return (
            <li
              key={s}
              className="flex items-center gap-2 text-xs"
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isDone
                    ? "bg-[color:var(--lavender)] text-[color:var(--background)]"
                    : isCurrent
                      ? "bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)] animate-pulse"
                      : "bg-[color:var(--border)] text-[color:var(--foreground-subtle)]"
                }`}
                aria-hidden
              >
                {isDone ? "✓" : i + 1}
              </span>
              <span
                className={
                  isDone || isCurrent
                    ? "text-[color:var(--foreground)]"
                    : "text-[color:var(--foreground-subtle)]"
                }
              >
                {STAGE_LABEL[s]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}