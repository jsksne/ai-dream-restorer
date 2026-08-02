import { describe, it, expect } from "vitest";
import {
  getContainedImageRect,
  pointerToNormalizedPoint,
  hitTestRegions,
} from "./image-geometry";

describe("getContainedImageRect", () => {
  it("横向 letterbox：宽屏容器渲染图片居中，左右留白", () => {
    const r = getContainedImageRect({
      containerWidth: 2000,
      containerHeight: 500,
      imageWidth: 1024,
      imageHeight: 1024,
    });
    // scale = min(2000/1024, 500/1024) = 500/1024 ≈ 0.488
    expect(r.height).toBeCloseTo(500, 1);
    expect(r.width).toBeCloseTo(500, 1);
    // 左右留白各 (2000 - 500)/2 = 750
    expect(r.left).toBeCloseTo(750, 0);
    expect(r.top).toBe(0);
  });

  it("纵向 letterbox：高容器居中渲染图片", () => {
    const r = getContainedImageRect({
      containerWidth: 500,
      containerHeight: 2000,
      imageWidth: 1024,
      imageHeight: 1024,
    });
    expect(r.width).toBeCloseTo(500, 1);
    expect(r.height).toBeCloseTo(500, 1);
    expect(r.left).toBe(0);
    expect(r.top).toBeCloseTo(750, 0);
  });

  it("正方形匹配：渲染矩形等于容器", () => {
    const r = getContainedImageRect({
      containerWidth: 800,
      containerHeight: 800,
      imageWidth: 1024,
      imageHeight: 1024,
    });
    expect(r.width).toBeCloseTo(800, 1);
    expect(r.height).toBeCloseTo(800, 1);
    expect(r.left).toBe(0);
    expect(r.top).toBe(0);
  });

  it("异常输入返回零矩形", () => {
    const r = getContainedImageRect({
      containerWidth: 0,
      containerHeight: 0,
      imageWidth: 0,
      imageHeight: 0,
    });
    expect(r.width).toBe(0);
    expect(r.height).toBe(0);
    expect(r.left).toBe(0);
    expect(r.top).toBe(0);
  });
});

describe("pointerToNormalizedPoint", () => {
  it("图片四角与中心归一化坐标正确", () => {
    // 容器在视口位置 (100, 200)，图片完全填充容器
    const containerRect = { left: 100, top: 200, width: 1000, height: 1000 };
    const imageRect = { left: 0, top: 0, width: 1000, height: 1000 };
    // 左上角：clientX=100 → localX=0 → dx=0 → x=0
    expect(pointerToNormalizedPoint(100, 200, containerRect, imageRect)).toEqual({ x: 0, y: 0 });
    // 右下角：clientX=1100 → localX=1000 → dx=1000 → x=1
    expect(pointerToNormalizedPoint(1100, 1200, containerRect, imageRect)).toEqual({ x: 1, y: 1 });
    // 中心
    expect(pointerToNormalizedPoint(600, 700, containerRect, imageRect)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("letterbox 区域返回 null", () => {
    // 假设图片在 container 中水平居中，左右有 200px 留白
    const containerRect2 = { left: 0, top: 0, width: 1200, height: 600 };
    const imageRect2 = { left: 200, top: 0, width: 800, height: 600 };
    expect(pointerToNormalizedPoint(50, 300, containerRect2, imageRect2)).toBeNull();
    expect(pointerToNormalizedPoint(1150, 300, containerRect2, imageRect2)).toBeNull();
    // 图片内有效点
    expect(pointerToNormalizedPoint(600, 300, containerRect2, imageRect2)).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("hitTestRegions", () => {
  const regions = [
    { id: "r1", box: { x: 0.0, y: 0.0, width: 0.5, height: 0.5 } },
    { id: "r2", box: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 } },
  ];

  it("命中第一个区域", () => {
    expect(hitTestRegions({ x: 0.2, y: 0.3 }, regions)).toBe("r1");
  });

  it("命中第二个区域", () => {
    expect(hitTestRegions({ x: 0.8, y: 0.8 }, regions)).toBe("r2");
  });

  it("未命中返回 null", () => {
    expect(hitTestRegions({ x: 0.6, y: 0.2 }, regions)).toBeNull();
  });
});