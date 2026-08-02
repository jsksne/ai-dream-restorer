import { describe, it, expect } from "vitest";
import { validatePromptCoachReply, DEFAULT_STYLES } from "./prompt-schema";

describe("validatePromptCoachReply", () => {
  it("合法 ready=true 直接通过", () => {
    const reply = validatePromptCoachReply({
      ready: true,
      summary: "梦境摘要",
      recommendedStyle: "电影感",
    });
    expect(reply.ready).toBe(true);
    expect(reply.summary).toBe("梦境摘要");
  });

  it("ready=true 时强制清空 options / question", () => {
    const reply = validatePromptCoachReply({
      ready: true,
      question: "不应出现",
      options: [{ id: "x", label: "x", value: "x" }],
    });
    expect(reply.question).toBeNull();
    expect(reply.options).toEqual([]);
  });

  it("ready=false 时必须有 2-4 个 options", () => {
    const noOptions = validatePromptCoachReply({
      ready: false,
      question: "你在哪里？",
      targetSlot: "place",
    });
    // 选项不足 2 → 自动升级为 ready=true
    expect(noOptions.ready).toBe(true);

    const oneOption = validatePromptCoachReply({
      ready: false,
      question: "你在哪里？",
      options: [{ id: "x", label: "海面", value: "海面" }],
    });
    expect(oneOption.ready).toBe(true);

    const twoOptions = validatePromptCoachReply({
      ready: false,
      question: "你在哪里？",
      targetSlot: "place",
      options: [
        { id: "1", label: "海面", value: "海面" },
        { id: "2", label: "森林", value: "森林" },
      ],
    });
    expect(twoOptions.ready).toBe(false);
    expect(twoOptions.options).toHaveLength(2);
  });

  it("选项上限 4", () => {
    const many = validatePromptCoachReply({
      ready: false,
      question: "你在哪里？",
      options: [
        { id: "1", label: "a", value: "a" },
        { id: "2", label: "b", value: "b" },
        { id: "3", label: "c", value: "c" },
        { id: "4", label: "d", value: "d" },
        { id: "5", label: "e", value: "e" },
        { id: "6", label: "f", value: "f" },
      ],
    });
    expect(many.options).toHaveLength(4);
  });

  it("轮次达到 3 时强制 ready", () => {
    const reply = validatePromptCoachReply({
      ready: false,
      round: 3,
      question: "还在追问",
      options: [
        { id: "1", label: "a", value: "a" },
        { id: "2", label: "b", value: "b" },
      ],
    });
    expect(reply.ready).toBe(true);
  });

  it("非法 targetSlot 降级为 null", () => {
    const reply = validatePromptCoachReply({
      ready: false,
      question: "什么时候？",
      targetSlot: "non-existent",
      options: [
        { id: "1", label: "白天", value: "白天" },
        { id: "2", label: "夜晚", value: "夜晚" },
      ],
    });
    expect(reply.targetSlot).toBeNull();
  });

  it("缺失字段容错", () => {
    expect(validatePromptCoachReply(null).ready).toBe(true);
    expect(validatePromptCoachReply("string").ready).toBe(true);
    expect(validatePromptCoachReply({}).ready).toBe(true);
  });

  it("summary 与 recommendedStyle 长度截断", () => {
    const reply = validatePromptCoachReply({
      ready: true,
      summary: "a".repeat(1000),
      recommendedStyle: "x".repeat(1000),
    });
    expect(reply.summary.length).toBeLessThanOrEqual(500);
    expect(reply.recommendedStyle.length).toBeLessThanOrEqual(100);
  });

  it("DEFAULT_STYLES 提供 6 个固定候选", () => {
    expect(DEFAULT_STYLES.length).toBeGreaterThanOrEqual(6);
    expect(DEFAULT_STYLES.map((s) => s.id)).toContain("cinematic");
    expect(DEFAULT_STYLES.map((s) => s.id)).toContain("cartoon");
  });
});