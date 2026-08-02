"use client";

// ===== 图像生成伪流式渲染组件 =====
// 两阶段：
//   1. loading：进度条（0→90% 假动画）+ "AI 正在描绘你的梦境..."文案 + 脉冲指示器
//   2. reveal：图像到达后，用 GSAP 把图切成 4×4 网格，逐块从 blur+透明 渐显
//
// spec E4：网格逐块 reveal + 进度条 + 文案

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

interface ImageRevealProps {
  /** 是否正在生成中（loading 阶段） */
  isGenerating: boolean;
  /** 图像 URL；loading 结束后传入即触发 reveal */
  imageUrl: string | null;
  /** 图像 alt 文案 */
  alt?: string;
  /** loading 阶段提示文案，默认 "AI 正在描绘你的梦境..." */
  loadingText?: string;
}

/**
 * 4×4 网格逐块 reveal + 进度条 + 文案
 *
 * - isGenerating=true 且无 imageUrl：显示 loading（进度条 + 文案 + 脉冲）
 * - isGenerating=false 且 imageUrl 存在：显示 16 格网格，GSAP 逐块 reveal
 * - 切换 imageUrl 时重新触发 reveal 动画
 */
export function ImageReveal({
  isGenerating,
  imageUrl,
  alt = "当前梦境画面",
  loadingText = "AI 正在描绘你的梦境...",
}: ImageRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // 预加载图像，确保网格背景图可用
  useEffect(() => {
    if (!imageUrl) {
      setImgLoaded(false);
      return;
    }
    setImgLoaded(false);
    const img = new Image();
    img.onload = () => setImgLoaded(true);
    img.onerror = () => setImgLoaded(true); // 失败也继续，避免卡住
    img.src = imageUrl;
  }, [imageUrl]);

  // GSAP 网格 reveal 动画
  useEffect(() => {
    if (!imgLoaded || !imageUrl || !containerRef.current) return;

    const cells = containerRef.current.querySelectorAll<HTMLDivElement>(".reveal-cell");
    if (cells.length === 0) return;

    const ctx = gsap.context(() => {
      // 初始状态
      gsap.set(cells, {
        opacity: 0,
        filter: "blur(20px) brightness(0.4)",
        scale: 1.08,
      });
      // 逐块 reveal，从中心向外 stagger
      gsap.to(cells, {
        opacity: 1,
        filter: "blur(0px) brightness(1)",
        scale: 1,
        duration: 0.7,
        ease: "power2.out",
        stagger: { each: 0.04, from: "center" },
      });
    }, containerRef);

    return () => ctx.revert();
  }, [imgLoaded, imageUrl]);

  // ===== loading 阶段 =====
  if (isGenerating && !imgLoaded) {
    return (
      <div
        className="relative w-full h-full flex flex-col items-center justify-center gap-5"
        role="status"
        aria-live="polite"
      >
        {/* 脉冲指示器（三点） */}
        <div className="flex items-center gap-3">
          <span
            className="w-3 h-3 rounded-full bg-[color:var(--lavender)] dream-pulse"
            aria-hidden
          />
          <span
            className="w-3 h-3 rounded-full bg-[color:var(--lavender-bright)] dream-pulse"
            style={{ animationDelay: "0.4s" }}
            aria-hidden
          />
          <span
            className="w-3 h-3 rounded-full bg-[color:var(--violet-deep)] dream-pulse"
            style={{ animationDelay: "0.8s" }}
            aria-hidden
          />
        </div>

        {/* 文案 */}
        <p
          className="text-base text-[color:var(--foreground-muted)] tracking-wide"
          style={{ fontFamily: "var(--font-serif), serif" }}
        >
          {loadingText}
        </p>

        {/* 进度条：0→90% 假动画（CSS indeterminate） */}
        <div
          className="relative w-48 h-1 rounded-full bg-[color:var(--background-soft)] overflow-hidden border border-[color:var(--border)]"
          aria-hidden
        >
          <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-[color:var(--lavender)] to-transparent progress-indeterminate" />
        </div>
      </div>
    );
  }

  // ===== 无图像占位 =====
  if (!imageUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center">
        <p className="text-base text-[color:var(--foreground-subtle)] tracking-wide">
          输入你的梦境描述，开始还原
        </p>
      </div>
    );
  }

  // ===== reveal 阶段：4×4 网格 =====
  const cells = Array.from({ length: 16 }, (_, i) => i);
  const bgSize = "400% 400%";
  // 每格的背景位置（百分比）：横向 4 列，纵向 4 行
  const col = (i: number) => i % 4;
  const row = (i: number) => Math.floor(i / 4);
  const bgPos = (i: number) =>
    `${(col(i) / 3) * 100}% ${(row(i) / 3) * 100}%`;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center"
    >
      <div className="reveal-grid w-full h-full max-w-full max-h-full">
        {cells.map((i) => (
          <div
            key={i}
            className="reveal-cell"
            style={{
              backgroundImage: imgLoaded ? `url(${imageUrl})` : undefined,
              backgroundSize: bgSize,
              backgroundPosition: bgPos(i),
              backgroundRepeat: "no-repeat",
            }}
            aria-hidden={i !== 0}
          />
        ))}
        {/* 不可见的完整图作为 a11y alt 载体 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={alt}
          className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
          draggable={false}
        />
      </div>
    </div>
  );
}
