"use client";

// ===== 提示词智能体浮窗 =====
// 显示当前问题、2-4 个选项 chip、风格选择、自由输入、跳过/直接生成
// 风格始终可见，不占用追问次数

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_STYLES,
  validatePromptCoachReply,
  type PromptCoachReply,
} from "@/lib/prompt-schema";

interface PromptCoachProps {
  initialDescription: string;
  round: number;
  onReady: (finalPrompt: string, style: string) => void;
  onCancel: () => void;
}

interface SlotAnswers {
  [k: string]: string;
}

export function PromptCoach({
  initialDescription,
  round,
  onReady,
  onCancel,
}: PromptCoachProps) {
  const [answers, setAnswers] = useState<SlotAnswers>({});
  const [freeText, setFreeText] = useState("");
  const [currentRound, setCurrentRound] = useState(round);
  const [style, setStyle] = useState<string>("电影感");
  const [reply, setReply] = useState<PromptCoachReply>({
    ready: false,
    question: null,
    targetSlot: null,
    options: [],
    allowFreeText: true,
    summary: initialDescription,
    recommendedStyle: "电影感",
    missingHighImpactSlots: [],
    round,
  });
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    setCurrentRound(round);
  }, [round]);

  // 触发后端追问
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setRequestError(null);
    (async () => {
      try {
        const merged = buildMergedDescription(initialDescription, answers, freeText);
        const res = await fetch("/api/agent-ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: `coach-${Date.now()}`,
            originalDescription: merged,
            answer: "coach",
            mode: "coach",
            round: currentRound,
          }),
        });
        if (!res.ok) {
          throw new Error("提示词智能体请求失败");
        }
        const data = (await res.json().catch(() => ({}))) as Partial<PromptCoachReply>;
        if (!cancelled) {
          const validated = validatePromptCoachReply(data);
          setReply(validated);
          if (validated.recommendedStyle) setStyle(validated.recommendedStyle);
        }
      } catch {
        if (!cancelled) {
          setRequestError("提示词智能体暂时无法连接，请重试或直接生成。");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRound, requestKey]);

  const handleOption = (value: string) => {
    if (!reply.targetSlot) return;
    const nextAnswers = { ...answers, [reply.targetSlot as string]: value };
    setAnswers(nextAnswers);
    if (currentRound >= 2 || reply.round >= 2) {
      // 强制 ready
      const merged = buildMergedDescription(initialDescription, nextAnswers, freeText);
      onReady(merged, style);
    } else {
      setCurrentRound((value) => Math.min(value + 1, 2));
    }
  };

  const handleSubmitFree = () => {
    const merged = buildMergedDescription(initialDescription, answers, freeText);
    onReady(merged, style);
  };

  if (typeof document === "undefined") return null;

  if (reply.ready) {
    return createPortal(
      <div
        role="dialog"
        aria-label="智能体摘要"
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-6 bg-black/60"
      >
        <div className="coach-panel max-w-lg w-full rounded-xl p-4 sm:p-5">
          <p className="text-[10px] tracking-widest text-[color:var(--foreground-subtle)] mb-2">
            现在可以生成
          </p>
          <p className="text-sm leading-relaxed mb-3 whitespace-pre-wrap">
            {reply.summary || initialDescription}
          </p>
          <p className="text-xs text-[color:var(--foreground-subtle)] mb-2">推荐风格：</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {DEFAULT_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.value)}
                className={`px-2 py-1 text-xs rounded-full border ${
                  style === s.value
                    ? "border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)]"
                    : "border-[color:var(--border)] text-[color:var(--foreground-subtle)] hover:border-[color:var(--lavender)]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs rounded-md border border-[color:var(--border)]"
            >
              再补充一点
            </button>
            <button
              type="button"
              onClick={() => onReady(reply.summary || initialDescription, style)}
              className="gogogo-button px-4 py-1.5 text-sm rounded-md"
            >
              <span>GOGOGO!</span>
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      role="dialog"
      aria-label="提示词智能体"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-6 bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="coach-panel max-w-lg w-full rounded-xl p-4 sm:p-5" aria-busy={busy}>
        <p className="text-[10px] tracking-widest text-[color:var(--foreground-subtle)] mb-2">
          智能体追问 · 第 {reply.round + 1} / 3 轮
        </p>
        {busy ? (
          <p role="status" className="mb-3 text-sm text-[color:var(--foreground-muted)]">正在根据你的描述组织下一个问题…</p>
        ) : requestError ? (
          <div role="alert" className="mb-3 rounded-md border border-[color:var(--error)] bg-[color:var(--error-soft)] px-3 py-2 text-sm text-[color:var(--error)]">
            <p>{requestError}</p>
            <button type="button" onClick={() => setRequestKey((key) => key + 1)} className="mt-2 rounded border border-current px-2 py-1 text-xs">重新提问</button>
          </div>
        ) : (
          <p className="text-sm leading-relaxed mb-3">{reply.question}</p>
        )}
        {!busy && !requestError && reply.options.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {reply.options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => handleOption(o.value)}
                disabled={busy}
                className="px-2.5 py-1 text-xs rounded-full border border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)] hover:bg-[color:var(--lavender)] hover:text-[color:var(--background)] transition-colors disabled:opacity-50"
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        {!busy && !requestError && reply.allowFreeText && (
          <input
            type="text"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="或者自由补充…"
            className="w-full px-2 py-1.5 text-sm rounded-md border border-[color:var(--border)] bg-[color:var(--background)] mb-3"
          />
        )}
        <p className="text-xs text-[color:var(--foreground-subtle)] mb-2">风格（不计入追问次数）：</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {DEFAULT_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s.value)}
              className={`px-2 py-1 text-xs rounded-full border ${
                style === s.value
                  ? "border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)]"
                  : "border-[color:var(--border)] text-[color:var(--foreground-subtle)] hover:border-[color:var(--lavender)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => {
              const merged = buildMergedDescription(initialDescription, answers, freeText);
              onReady(merged, style);
            }}
            className="px-3 py-1.5 text-xs rounded-md border border-[color:var(--border)]"
          >
            记不清，交给 AI
          </button>
          <button
            type="button"
            onClick={handleSubmitFree}
            className="px-3 py-1.5 text-xs rounded-md border border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)]"
          >
            现在就生成
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function buildMergedDescription(
  initial: string,
  answers: SlotAnswers,
  free: string
): string {
  const parts: string[] = [initial.trim()].filter(Boolean);
  for (const [k, v] of Object.entries(answers)) {
    if (v) parts.push(`[${k}] ${v}`);
  }
  if (free.trim()) parts.push(free.trim());
  return parts.join("\n");
}
