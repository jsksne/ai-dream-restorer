"use client";

// ===== Oneira 画面区组件（v2 重构版）=====
// - 使用 getContainedImageRect 计算实际图片边界
// - pointerToNormalizedPoint 处理 letterbox
// - 支持场景区域图（SceneRegion）hover 高光
// - 暗区 hover 显示柔和探索圈
// - 单击调用 onDirectExplore；Shift+点击调用 onShiftClick

import { useRef, useState, useCallback } from "react";
import { ImageReveal } from "./ImageReveal";
import type { SceneRegion, SemanticTags } from "@/types";
import {
  getContainedImageRect,
  pointerToNormalizedPoint,
  hitTestRegions,
} from "@/lib/image-geometry";

export interface ElementClickInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  shiftKey: boolean;
}

interface DreamCanvasProps {
  imageUrl: string | null;
  isGenerating: boolean;
  semanticTags?: SemanticTags | null;
  sceneRegions?: SceneRegion[];
  transition?: "reveal" | "lens";
  onDirectExplore: (info: ElementClickInfo) => void;
  onShiftClick: (info: ElementClickInfo) => void;
}

export function DreamCanvas({
  imageUrl,
  isGenerating,
  sceneRegions,
  transition = "reveal",
  onDirectExplore,
  onShiftClick,
}: DreamCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 1024, h: 1024 });
  const [hoverRegion, setHoverRegion] = useState<{ id: string; label: string } | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [containerWidth, setContainerWidth] = useState(0);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      const img = imgRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const imgW = img?.naturalWidth || naturalSize.w;
      const imgH = img?.naturalHeight || naturalSize.h;
      const imageRect = getContainedImageRect({
        containerWidth: rect.width,
        containerHeight: rect.height,
        imageWidth: imgW,
        imageHeight: imgH,
      });
      const point = pointerToNormalizedPoint(
        e.clientX,
        e.clientY,
        { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        imageRect
      );
      if (!point) return; // letterbox 区域不响应
      const info: ElementClickInfo = {
        x: point.x,
        y: point.y,
        width: rect.width,
        height: rect.height,
        shiftKey: e.shiftKey,
      };
      if (e.shiftKey) {
        onShiftClick(info);
      } else {
        onDirectExplore(info);
      }
    },
    [naturalSize.w, naturalSize.h, onDirectExplore, onShiftClick]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      const img = imgRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const imgW = img?.naturalWidth || naturalSize.w;
      const imgH = img?.naturalHeight || naturalSize.h;
      const imageRect = getContainedImageRect({
        containerWidth: rect.width,
        containerHeight: rect.height,
        imageWidth: imgW,
        imageHeight: imgH,
      });
      const point = pointerToNormalizedPoint(
        e.clientX,
        e.clientY,
        { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        imageRect
      );
      setContainerWidth(rect.width);
      if (!point) {
        setHoverRegion(null);
        return;
      }
      const regions = sceneRegions ?? [];
      const id = hitTestRegions(point, regions);
      if (id) {
        const found = regions.find((r) => r.id === id);
        if (found) {
          setHoverRegion({ id, label: found.label });
          setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          return;
        }
      }
      setHoverRegion({ id: "__explore__", label: "探索" });
      setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    [naturalSize.w, naturalSize.h, sceneRegions]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverRegion(null);
  }, []);

  if (isGenerating && transition === "reveal") {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <ImageReveal isGenerating={isGenerating} imageUrl={imageUrl} />
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center">
        <p
          className="text-base text-[color:var(--foreground-subtle)] tracking-wide"
          style={{ fontFamily: "var(--font-serif), serif" }}
        >
          输入你的梦境描述，开始还原
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center cursor-crosshair overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        key={imageUrl}
        src={imageUrl}
        alt="当前梦境画面"
        className="w-full h-full object-contain rounded-lg lens-in-animation"
        draggable={false}
        onLoad={(e) => {
          const el = e.currentTarget;
          setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight });
        }}
      />

      {/* 场景区域高亮 */}
      {hoverRegion && hoverRegion.id !== "__explore__" && (() => {
        const r = sceneRegions?.find((x) => x.id === hoverRegion.id);
        if (!r) return null;
        return (
          <div
            className="region-highlight region-highlight--active"
            style={{
              left: `${r.box.x * 100}%`,
              top: `${r.box.y * 100}%`,
              width: `${r.box.width * 100}%`,
              height: `${r.box.height * 100}%`,
              position: "absolute",
            }}
            aria-hidden
          />
        );
      })()}

      {/* 探索圈（未命中已知区域） */}
      {hoverRegion?.id === "__explore__" && (
        <div
          className="explore-circle"
          style={{
            left: hoverPos.x - 32,
            top: hoverPos.y - 32,
            position: "absolute",
            width: 64,
            height: 64,
          }}
          aria-hidden
        />
      )}

      {/* hover tooltip */}
      {hoverRegion && (
        <div
          className="element-tooltip"
          style={{
            left: Math.min(hoverPos.x + 12, containerWidth - 100),
            top: Math.max(hoverPos.y - 28, 8),
            position: "absolute",
          }}
          aria-hidden
        >
          {hoverRegion.label}
        </div>
      )}
    </div>
  );
}

// 保留旧 ElementClickInfo 类型导出
export type { SemanticTags };