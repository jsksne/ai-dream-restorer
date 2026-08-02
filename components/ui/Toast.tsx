'use client';

// ===== 手写 Toast 组件（无 Radix 依赖） =====
// 顶部固定区域堆叠显示，自动消失，支持 4 种语义
// 通过 useToast() hook 暴露 showToast 函数

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastKind = 'info' | 'success' | 'warning' | 'error';

interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
  duration: number; // ms
  leaving?: boolean;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_STYLES: Record<ToastKind, { color: string; bg: string; border: string; icon: string }> = {
  info: {
    color: 'var(--lavender-bright)',
    bg: 'var(--violet-deep-soft)',
    border: 'var(--lavender)',
    icon: 'ℹ',
  },
  success: {
    color: 'var(--success)',
    bg: 'var(--success-soft)',
    border: 'var(--success)',
    icon: '✓',
  },
  warning: {
    color: 'var(--warning)',
    bg: 'var(--warning-soft)',
    border: 'var(--warning)',
    icon: '⚠',
  },
  error: {
    color: 'var(--error)',
    bg: 'var(--error-soft)',
    border: 'var(--error)',
    icon: '✕',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    // 等动画结束后真正移除
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = 'info', duration = 3200) => {
      counterRef.current += 1;
      const id = `toast-${counterRef.current}`;
      const item: ToastItem = { id, kind, message, duration };
      setItems((prev) => [...prev, item]);
      setTimeout(() => removeToast(id), duration);
    },
    [removeToast]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast 容器：顶部居中堆叠 */}
      <div
        className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[200] flex w-[calc(100vw-1.5rem)] max-w-[480px] -translate-x-1/2 flex-col items-center gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="true"
      >
        {items.map((t) => {
          const style = KIND_STYLES[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className={`glass-overlay pointer-events-auto flex w-full items-center gap-3 px-4 py-3 ${t.leaving ? 'toast-out' : 'toast-in'}`}
              style={{ borderColor: style.border }}
            >
              <span
                aria-hidden
                className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
              >
                {style.icon}
              </span>
              <p className="text-sm text-[color:var(--foreground)] leading-relaxed flex-1">
                {t.message}
              </p>
              <button
                type="button"
                aria-label="关闭提示"
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-[color:var(--foreground-subtle)] hover:text-[color:var(--foreground)] transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** useToast hook：在 ToastProvider 内部使用 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // 降级：在 Provider 外使用时返回 no-op，避免崩溃
    return {
      showToast: (msg: string) => {
        if (typeof console !== 'undefined') console.warn('[Toast]', msg);
      },
    };
  }
  return ctx;
}

/** 在客户端组件中方便使用（保证 hooks 调用顺序） */
export function useToastEffect(message: string | null, kind: ToastKind = 'info', deps: unknown[] = []) {
  const { showToast } = useToast();
  useEffect(() => {
    if (message) showToast(message, kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, ...deps]);
}
