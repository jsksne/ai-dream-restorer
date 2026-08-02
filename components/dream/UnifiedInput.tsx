"use client";

// ===== Oneira 统一输入框组件（v2 重构版） =====
// 底部浮层玻璃拟态，根据「是否打字」「是否选中元素」自动分发三种行为：
//   - 只打字（无元素）   → refine（微调当前画面）
//   - 只点元素（无文本） → auto-explore（自动探索该元素）
//   - 点元素 + 打字      → guided-explore（引导式探索）
//
// 边界处理：
//   - 空输入不触发
//   - >500 字截断 + toast 提示
//   - 生成中按钮 disabled（仍允许输入排队）
//
// 无 Radix / 无 sakura

import { useCallback } from "react";
import type { ActionType } from "@/types";
import { useToast } from "@/components/ui/Toast";
import { Tooltip } from "@/components/ui/Tooltip";

export interface SubmitPayload {
  action: ActionType;
  element: string | null;
}

interface UnifiedInputProps {
  /** 当前输入文本（受控） */
  value: string;
  /** 当前选中的元素名（来自画面点击），未选中为 null */
  selectedElement: string | null;
  /** 是否已有活动梦境节点 */
  hasActiveNode?: boolean;
  /** 是否正在生成中（按钮 disabled，但仍允许输入） */
  isGenerating: boolean;
  /** 文本变化回调 */
  onChange: (value: string) => void;
  /**
   * 提交回调
   * @param text 用户输入的文本（trim 后；自动探索时为空串）
   * @param payload 包含 action 与 element
   */
  onSubmit: (text: string, payload: SubmitPayload) => void;
  /** 清除选中元素回调 */
  onClearElement: () => void;
}

const MAX_LEN = 500;

/**
 * 根据文本与元素状态分发行为
 * - 无文本 + 无元素 → 返回 null（不提交）
 * - 有文本 + 无元素 → refine
 * - 无文本 + 有元素 → auto-explore
 * - 有文本 + 有元素 → guided-explore
 */
export function dispatchAction(
  text: string,
  element: string | null,
  hasActiveNode = false
): SubmitPayload | null {
  const hasText = text.trim().length > 0;
  const hasElement = element != null && element.trim().length > 0;

  if (!hasText && !hasElement) return null;
  if (!hasElement) {
    return { action: hasActiveNode ? "refine" : "initial", element: null };
  }
  if (!hasText) return { action: "auto-explore", element };
  return { action: "guided-explore", element };
}

export function UnifiedInput({
  value,
  selectedElement,
  hasActiveNode = false,
  isGenerating,
  onChange,
  onSubmit,
  onClearElement,
}: UnifiedInputProps) {
  const { showToast } = useToast();
  const hasElement = selectedElement != null && selectedElement.trim().length > 0;

  const placeholder = hasElement
    ? "描述想怎么探索这个元素…（留空则自动探索）"
    : "描述梦境，或点击画面元素开始探索…";

  const handleSubmit = useCallback(() => {
    const payload = dispatchAction(value, selectedElement, hasActiveNode);
    if (!payload) return;

    // 超长截断 + toast 提示
    let text = value.trim();
    if (text.length > MAX_LEN) {
      text = text.slice(0, MAX_LEN);
      showToast(`描述超过 ${MAX_LEN} 字，已截断`, "warning");
    }

    onSubmit(text, payload);
  }, [value, selectedElement, hasActiveNode, onSubmit, showToast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full">
      {/* 选中元素时的上下文提示条 */}
      {hasElement && (
        <div className="mb-2 flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-[color:var(--lavender-soft)] border border-[color:var(--lavender-glow)] text-[color:var(--lavender-bright)] flex items-center gap-1">
            <span aria-hidden>→</span>
            <span>探索：</span>
            <span className="font-medium">{selectedElement}</span>
          </span>
          <button
            type="button"
            onClick={onClearElement}
            aria-label="清除选中元素"
            title="清除选中元素"
            className="px-1.5 py-0.5 rounded-full border border-[color:var(--border)] text-[color:var(--foreground-subtle)] hover:border-[color:var(--lavender)] hover:text-[color:var(--lavender-bright)] transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* 输入框 + 发送按钮 */}
      <div className="flex items-end gap-2 glass-overlay px-3 py-2 input-glow">
        <textarea
          aria-label="梦境描述输入框"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={MAX_LEN + 50} // 允许略微超出以触发截断 toast
          className="flex-1 resize-none bg-transparent border-0 outline-none text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--foreground-subtle)] py-1 max-h-32"
        />
        {isGenerating ? (
          // 生成中：tooltip 提示原因
          <Tooltip content="正在生成中，请稍候…" placement="top">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={true}
              aria-label="生成中"
              className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[color:var(--lavender-soft)] disabled:hover:text-[color:var(--lavender-bright)]"
            >
              生成中...
            </button>
          </Tooltip>
        ) : value.trim().length === 0 && !hasElement ? (
          // 空输入且无元素：tooltip 提示
          <Tooltip content="请先输入梦境描述或点击画面元素" placement="top">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={true}
              aria-label="发送"
              className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[color:var(--lavender-soft)] disabled:hover:text-[color:var(--lavender-bright)]"
            >
              发送
            </button>
          </Tooltip>
        ) : (
          // 正常可点击
          <button
            type="button"
            onClick={handleSubmit}
            disabled={false}
            aria-label="发送"
            className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)] hover:bg-[color:var(--lavender)] hover:text-[color:var(--background)]"
          >
            发送
          </button>
        )}
      </div>
    </div>
  );
}
