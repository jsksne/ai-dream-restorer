import { describe, it, expect } from "vitest";
import { buildExplorationPrompt, detectDarkerIntent } from "./exploration-prompt";

describe("buildExplorationPrompt", () => {
  it("包含镜头深入/放大语义", () => {
    const p = buildExplorationPrompt({ elementName: "门洞" });
    expect(p).toContain("聚焦元素");
    expect(p).toContain("门洞");
    expect(p).toContain("镜头");
  });

  it("暗区探索提示保留曝光与色调", () => {
    const p = buildExplorationPrompt({ elementName: "暗门洞" });
    expect(p).toMatch(/保留原场景的曝光关系/);
    expect(p).toMatch(/整体色调/);
  });

  it("包含'揭示区域内部'语义", () => {
    const p = buildExplorationPrompt({ elementName: "门洞" });
    expect(p).toContain("揭示");
    expect(p).toContain("内部");
  });

  it("用户未要求变暗时不强制压暗", () => {
    const p = buildExplorationPrompt({ elementName: "夜空" });
    expect(p).toMatch(/不要整体压暗/);
    expect(p).toMatch(/不要以'更暗'为目标/);
  });

  it("用户明确要求变暗时移除压暗保护规则", () => {
    const p = buildExplorationPrompt({
      elementName: "门洞",
      userHint: "再黑一点",
      userWantsDarker: true,
    });
    expect(p).toMatch(/可以营造更暗的氛围/);
    expect(p).not.toMatch(/不要以'更暗'为目标/);
  });

  it("用户补充内容优先于默认保护", () => {
    const p = buildExplorationPrompt({
      elementName: "月亮",
      userHint: "让月亮看起来更冷一些",
    });
    expect(p).toContain("用户补充");
    expect(p.indexOf("用户补充")).toBeLessThan(p.indexOf("保留原场景"));
  });

  it("夜空/阴影场景同样应用保护", () => {
    const sky = buildExplorationPrompt({ elementName: "夜空" });
    expect(sky).toMatch(/揭示/);
    const shadow = buildExplorationPrompt({ elementName: "阴影区域" });
    expect(shadow).toMatch(/保留原场景的曝光关系/);
  });
});

describe("detectDarkerIntent", () => {
  const positive = [
    "再黑一点",
    "让画面变暗",
    "夜里的时候",
    "夜晚场景",
    "make it darker",
    "dark night",
  ];
  const negative = ["保持原样", "明亮一些", "阳光"];

  for (const text of positive) {
    it(`检测到 ${text}`, () => {
      expect(detectDarkerIntent(text)).toBe(true);
    });
  }

  for (const text of negative) {
    it(`未检测到 ${text}`, () => {
      expect(detectDarkerIntent(text)).toBe(false);
    });
  }

  it("undefined 返回 false", () => {
    expect(detectDarkerIntent(undefined)).toBe(false);
  });
});