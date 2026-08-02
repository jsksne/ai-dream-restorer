"use client";

// ===== Agent 协作状态浮层 =====
// 浮层显示当前 active agent + 任务状态
// 当 status 为 working/input-required 时显示，completed/failed/idle 时隐藏

import { useMemo } from "react";
import type { AgentId, TaskStatus } from "@/lib/agents/types";

interface AgentStatusOverlayProps {
  /** 当前活跃 agent */
  activeAgent?: AgentId | null;
  /** 任务状态 */
  status: TaskStatus | "idle";
  /** 是否存在错误 */
  error?: string | null;
}

const AGENT_LABELS: Record<AgentId, { name: string; verb: string }> = {
  "prompt-optimizer": {
    name: "提示词优化智能体",
    verb: "正在分析你的描述",
  },
  "dream-generator": {
    name: "生成智能体",
    verb: "正在描绘梦境画面",
  },
  "dream-analyzer": {
    name: "分析智能体",
    verb: "正在生成心理分析",
  },
};

export function AgentStatusOverlay({
  activeAgent,
  status,
  error,
}: AgentStatusOverlayProps) {
  const visible =
    status === "working" || status === "submitted" || status === "input-required";

  const label = useMemo(() => {
    if (!activeAgent) return null;
    return AGENT_LABELS[activeAgent] ?? null;
  }, [activeAgent]);

  if (error && status === "failed") {
    return (
      <div
        className="agent-badge fixed top-4 right-4 z-30 fade-in"
        style={{ borderColor: "var(--error)" }}
        role="alert"
      >
        <span
          aria-hidden
          className="agent-badge__dot"
          style={{ background: "var(--error)" }}
        />
        <span className="text-[color:var(--error)]">任务失败</span>
      </div>
    );
  }

  if (!visible || !label) return null;

  return (
    <div
      className="agent-badge fixed top-4 right-4 z-30 fade-in-up"
      role="status"
      aria-live="polite"
    >
      <span aria-hidden className="agent-badge__dot" />
      <span className="text-[color:var(--lavender-bright)]">{label.name}</span>
      <span className="text-[color:var(--foreground-subtle)]">·</span>
      <span className="text-[color:var(--foreground-muted)]">{label.verb}</span>
    </div>
  );
}
