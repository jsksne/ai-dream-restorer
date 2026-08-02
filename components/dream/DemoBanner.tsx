"use client";

interface DemoBannerProps {
  visible: boolean;
  onRecover: () => void;
}

export function DemoBanner({ visible, onRecover }: DemoBannerProps) {
  if (!visible) return null;
  return (
    <div role="status" className="fixed top-14 left-1/2 z-[45] flex w-[min(92vw,42rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-lg border border-[color:var(--warning)] bg-[color:var(--background-card)] px-3 py-2 text-xs shadow-lg">
      <span className="text-[color:var(--foreground-muted)]">当前处于演示模式，真实服务暂时不可用；生成结果仅用于体验。</span>
      <button type="button" onClick={onRecover} className="shrink-0 rounded-md border border-[color:var(--warning)] px-2 py-1 text-[color:var(--warning)]">恢复真实模式</button>
    </div>
  );
}