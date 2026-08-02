'use client';

// ===== 手写 Tooltip 组件（无 Radix 依赖） =====
// hover/focus 显示，position 自动检测上下溢出，简单位移策略

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  /** 偏好位置，默认 top */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** 延迟显示 ms，默认 100 */
  showDelay?: number;
  /** 延迟隐藏 ms，默认 80 */
  hideDelay?: number;
}

type ActualPlacement = 'top' | 'bottom' | 'left' | 'right';

export function Tooltip({
  content,
  children,
  placement = 'top',
  showDelay = 100,
  hideDelay = 80,
}: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 计算位置 + 自动避让
  useLayoutEffect(() => {
    if (!visible) return;
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    const tRect = trigger.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    const margin = 8;

    let p: ActualPlacement = placement;
    // 上下溢出检测
    if (placement === 'top' && tRect.top - tipRect.height - margin < 8) {
      p = 'bottom';
    } else if (placement === 'bottom' && tRect.bottom + tipRect.height + margin > window.innerHeight - 8) {
      p = 'top';
    } else if (placement === 'left' && tRect.left - tipRect.width - margin < 8) {
      p = 'right';
    } else if (placement === 'right' && tRect.right + tipRect.width + margin > window.innerWidth - 8) {
      p = 'left';
    }

    let left = 0;
    let top = 0;
    if (p === 'top') {
      left = tRect.left + tRect.width / 2 - tipRect.width / 2;
      top = tRect.top - tipRect.height - margin;
    } else if (p === 'bottom') {
      left = tRect.left + tRect.width / 2 - tipRect.width / 2;
      top = tRect.bottom + margin;
    } else if (p === 'left') {
      left = tRect.left - tipRect.width - margin;
      top = tRect.top + tRect.height / 2 - tipRect.height / 2;
    } else {
      left = tRect.right + margin;
      top = tRect.top + tRect.height / 2 - tipRect.height / 2;
    }

    // 边界夹紧
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tipRect.height - 8));

    setCoords({ left, top });
  }, [visible, placement]);

  const clearTimers = () => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const handleEnter = () => {
    clearTimers();
    showTimer.current = setTimeout(() => setVisible(true), showDelay);
  };

  const handleLeave = () => {
    clearTimers();
    hideTimer.current = setTimeout(() => setVisible(false), hideDelay);
  };

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocus={handleEnter}
        onBlur={handleLeave}
        className="inline-flex"
        style={{ outline: 'none' }}
      >
        {children}
      </span>
      {visible && (
        <span
          ref={tooltipRef}
          role="tooltip"
          className="tooltip-in element-tooltip"
          style={{
            left: coords.left,
            top: coords.top,
            position: 'fixed',
          }}
        >
          {content}
        </span>
      )}
    </>
  );
}
