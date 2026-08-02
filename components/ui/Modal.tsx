'use client';

// ===== 手写 Modal 组件（无 Radix 依赖） =====
// 遵循 WAI-ARIA Dialog 模式，但键盘焦点管理为次要优先级
// 提供 backdrop + panel + close button + 二次确认变体

import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** 自定义底部按钮区（如确认/取消） */
  footer?: ReactNode;
  /** 点击 backdrop 是否关闭，默认 true */
  closeOnBackdrop?: boolean;
  /** 是否显示右上角关闭按钮，默认 true */
  showCloseButton?: boolean;
  /** 最大宽度（Tailwind 类名片段，如 max-w-md），默认 max-w-lg */
  maxWidth?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  closeOnBackdrop = true,
  showCloseButton = true,
  maxWidth = 'max-w-lg',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC 键关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // 锁定 body 滚动
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        className="modal-backdrop absolute inset-0 bg-black/60"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={`modal-panel glass-panel relative w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden`}
        tabIndex={-1}
      >
        {title && (
          <header className="shrink-0 px-6 py-4 border-b border-[color:var(--border)]">
            <h2
              id="modal-title"
              className="text-lg font-semibold text-gradient-lavender"
              style={{ fontFamily: 'var(--font-serif), serif' }}
            >
              {title}
            </h2>
          </header>
        )}

        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="icon-button absolute top-3 right-3 z-10"
          >
            <svg
              width="16"
              height="16"
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
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {footer && (
          <footer className="shrink-0 px-6 py-3 border-t border-[color:var(--border)] flex items-center justify-end gap-2">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/** 二次确认 Modal 变体 */
interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** 确认按钮样式变体：'danger' | 'primary' */
  variant?: 'danger' | 'primary';
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
  variant = 'primary',
}: ConfirmModalProps) {
  const confirmClass =
    variant === 'danger'
      ? 'px-4 py-2 rounded-lg text-sm font-medium border border-[color:var(--error)] bg-[color:var(--error-soft)] text-[color:var(--error)] hover:bg-[color:var(--error)] hover:text-white transition-colors'
      : 'px-4 py-2 rounded-lg text-sm font-medium border border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)] hover:bg-[color:var(--lavender)] hover:text-[color:var(--background)] transition-colors';

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      maxWidth="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-[color:var(--border)] text-[color:var(--foreground-muted)] hover:border-[color:var(--border-hover)] transition-colors"
          >
            {cancelText}
          </button>
          <button type="button" onClick={onConfirm} className={confirmClass}>
            {confirmText}
          </button>
        </>
      }
    >
      <p className="text-sm text-[color:var(--foreground-muted)] leading-relaxed">
        {message}
      </p>
    </Modal>
  );
}
