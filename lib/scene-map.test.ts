import { describe, it, expect } from "vitest";
import { validateSceneMap } from "./scene-map";

describe("validateSceneMap", () => {
  it("合法输入返回规范化结果", () => {
    const out = validateSceneMap([
      { label: "月亮", box: { x: 0.4, y: 0.05, width: 0.2, height: 0.2 }, confidence: 0.9 },
      { label: "大海", box: { x: 0.0, y: 0.5, width: 1.0, height: 0.5 }, confidence: 0.8 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]?.label).toBe("月亮");
    expect(out[0]?.confidence).toBe(0.9);
  });

  it("面积过小（< 0.5%）被过滤", () => {
    const out = validateSceneMap([
      { label: "噪点", box: { x: 0.5, y: 0.5, width: 0.001, height: 0.001 }, confidence: 0.9 },
    ]);
    expect(out).toHaveLength(0);
  });

  it("面积过大（> 50%）被过滤", () => {
    const out = validateSceneMap([
      { label: "整体", box: { x: 0, y: 0, width: 1, height: 1 }, confidence: 0.9 },
    ]);
    expect(out).toHaveLength(0);
  });

  it("置信度过低被过滤", () => {
    const out = validateSceneMap([
      { label: "不稳", box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }, confidence: 0.2 },
    ]);
    expect(out).toHaveLength(0);
  });

  it("box 越界自动裁剪", () => {
    const out = validateSceneMap([
      { label: "溢出", box: { x: 0.9, y: 0.9, width: 0.5, height: 0.5 }, confidence: 0.9 },
    ]);
    expect(out).toHaveLength(1);
    const r = out[0];
    expect(r).toBeDefined();
    expect(r!.box.x + r!.box.width).toBeLessThanOrEqual(1.0001);
    expect(r!.box.y + r!.box.height).toBeLessThanOrEqual(1.0001);
  });

  it("空标签被过滤", () => {
    const out = validateSceneMap([
      { label: "  ", box: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 }, confidence: 0.9 },
    ]);
    expect(out).toHaveLength(0);
  });

  it("区域数量上限 8", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      label: `r${i}`,
      box: { x: 0.05 + (i % 4) * 0.2, y: 0.05 + Math.floor(i / 4) * 0.2, width: 0.15, height: 0.15 },
      confidence: 0.9,
    }));
    const out = validateSceneMap(many);
    expect(out.length).toBe(8);
  });

  it("非数组输入返回空", () => {
    expect(validateSceneMap(null)).toEqual([]);
    expect(validateSceneMap("not array")).toEqual([]);
    expect(validateSceneMap({})).toEqual([]);
  });
});