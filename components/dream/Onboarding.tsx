"use client";

// ===== 首屏 Onboarding 引导浮层 =====
// 每次进入页面都显示，分三步引导：
//   1. 欢迎页（弹窗）
//   2. 选择「我来掌舵 / AI 带我冲」教学强度
//   3. 操作规则（单击画面元素、标记版本开始分析）
// 模式选择持久化，引导弹窗本身不持久化（刷新后仍可见）

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";

const STORAGE_KEY = "oneira-onboarding-seen";
const MODE_STORAGE_KEY = "oneira-onboarding-mode";
export type OnboardingMode = "manual" | "auto";

interface OnboardingProps {
  /** 强制显示（忽略 localStorage，用于清空会话后回归） */
  force?: boolean;
  onModeSelected?: (mode: OnboardingMode) => void;
}

const RULES: Array<{ icon: string; title: string; desc: string }> = [
  {
    icon: "👆",
    title: "单击画面元素",
    desc: "直接进入该元素的子梦境，镜头层层下潜，探索梦中之梦。",
  },
  {
    icon: "✦",
    title: "标记版本，开始分析",
    desc: "在版本缩略图上点「开始分析」，AI 将生成四维度心理分析。",
  },
];

export function Onboarding({ force = false, onModeSelected }: OnboardingProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<OnboardingMode | null>(null);
  const [step, setStep] = useState<"welcome" | "mode" | "rules">("welcome");

  useEffect(() => {
    if (force) {
      setMode(null);
      setStep("welcome");
      setOpen(true);
      return;
    }
    try {
      const storedMode = localStorage.getItem(MODE_STORAGE_KEY);
      if (storedMode === "manual" || storedMode === "auto") setMode(storedMode);
    } catch {
      // 忽略
    }
    // 每次进入页面都显示引导（刷新后仍可见），不持久化"已看过"
    setStep("welcome");
    setOpen(true);
  }, [force]);

  const handleModeSelect = (nextMode: OnboardingMode) => {
    setMode(nextMode);
    onModeSelected?.(nextMode);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, nextMode);
    } catch {
      // 忽略存储异常
    }
    setStep("rules");
  };

  const handleClose = () => {
    if (step === "mode" && !mode) return;
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // 忽略 QuotaExceededError
    }
  };

  if (!open) return null;

  const footerButton =
    step === "welcome" ? (
      <button
        type="button"
        onClick={() => setStep("mode")}
        className="px-4 py-1.5 rounded-md text-sm border border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)] hover:bg-[color:var(--lavender)] hover:text-[color:var(--background)] transition-colors"
      >
        继续
      </button>
    ) : step === "mode" ? (
      <button
        type="button"
        disabled
        className="px-4 py-1.5 rounded-md text-sm border border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        先选择一种方式
      </button>
    ) : (
      <button
        type="button"
        onClick={handleClose}
        className="px-4 py-1.5 rounded-md text-sm border border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)] hover:bg-[color:var(--lavender)] hover:text-[color:var(--background)] transition-colors"
      >
        开始还原我的梦
      </button>
    );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === "welcome" ? "欢迎进入 Oneira" : "选择相处方式"}
      closeOnBackdrop={false}
      maxWidth="max-w-md"
      showCloseButton={step !== "mode"}
      footer={footerButton}
    >
      {step === "welcome" ? (
        <div className="space-y-3">
          <p
            className="text-sm text-[color:var(--foreground-muted)] leading-relaxed"
            style={{ fontFamily: "var(--font-serif), serif" }}
          >
            在这里，你可以像证人画像师一样，在 AI 引导下逐步还原记忆中的梦境。
          </p>
          <p className="text-xs text-[color:var(--foreground-subtle)] leading-relaxed">
            接下来会先选择一种相处方式，再介绍画面探索的两种玩法。
          </p>
        </div>
      ) : step === "mode" ? (
        <div className="space-y-3">
          <p className="text-sm text-[color:var(--foreground-muted)] leading-relaxed">先选择一种与你相处的方式，之后可以在设置里重新播放引导。</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => handleModeSelect("manual")} className="text-left rounded-lg border border-[color:var(--border)] p-3 hover:border-[color:var(--lavender)] transition-colors">
              <span className="block text-sm font-medium">我来掌舵</span>
              <span className="mt-1 block text-xs text-[color:var(--foreground-subtle)]">我自己描述与决定每一步。</span>
            </button>
            <button type="button" onClick={() => handleModeSelect("auto")} className="text-left rounded-lg border border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] p-3 hover:bg-[color:var(--lavender)] hover:text-[color:var(--background)] transition-colors">
              <span className="block text-sm font-medium">AI 带我冲</span>
              <span className="mt-1 block text-xs text-[color:var(--foreground-subtle)]">AI 用少量追问帮我补齐画面。</span>
            </button>
          </div>
        </div>
      ) : (
      <>
      <p
        className="text-sm text-[color:var(--foreground-muted)] mb-4 leading-relaxed"
        style={{ fontFamily: "var(--font-serif), serif" }}
      >
        在这里，你可以像证人画像师一样，在 AI 引导下逐步还原记忆中的梦境。
      </p>
      <ul className="space-y-3">
        {RULES.map((r) => (
          <li key={r.title} className="flex items-start gap-3">
            <span
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm bg-[color:var(--violet-deep-soft)] border border-[color:var(--border)] text-[color:var(--lavender-bright)]"
              aria-hidden
            >
              {r.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[color:var(--foreground)]">
                {r.title}
              </p>
              <p className="text-xs text-[color:var(--foreground-subtle)] leading-relaxed mt-0.5">
                {r.desc}
              </p>
            </div>
          </li>
        ))}
      </ul>
      </>
      )}
    </Modal>
  );
}

/** 暴露重置 onboarding 状态的工具函数（清空会话时调用） */
export function resetOnboarding() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(MODE_STORAGE_KEY);
  } catch {
    // 忽略
  }
}
