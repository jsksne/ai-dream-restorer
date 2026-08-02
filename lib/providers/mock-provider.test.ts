import { describe, it, expect } from "vitest";
import { MockProvider } from "./mock-provider";

describe("MockProvider", () => {
  it("默认 seed 产生稳定结果", async () => {
    const a = new MockProvider({ seed: 42 });
    const b = new MockProvider({ seed: 42 });
    const tagA = await a.generateSemanticTags("any");
    const tagB = await b.generateSemanticTags("any");
    expect(tagA).toEqual(tagB);
  });

  it("text2Image 返回 imageUrl", async () => {
    const p = new MockProvider({ latencyMs: { min: 0, max: 1 } });
    const out = await p.text2Image("夜晚的海面");
    expect(out.imageUrl).toMatch(/dream_/);
  });

  it("注入 429 错误", async () => {
    const p = new MockProvider({ latencyMs: { min: 0, max: 1 } });
    p.setFailure({ callIndex: 1, kind: "429" });
    await expect(p.text2Image("test")).rejects.toThrow(/429/);
  });

  it("注入 500 错误", async () => {
    const p = new MockProvider({ latencyMs: { min: 0, max: 1 } });
    p.setFailure({ callIndex: 1, kind: "500" });
    await expect(p.text2Image("test")).rejects.toThrow(/500/);
  });

  it("注入超时", async () => {
    const p = new MockProvider({ latencyMs: { min: 0, max: 1 } });
    p.setFailure({ callIndex: 1, kind: "timeout" });
    await expect(p.text2Image("test")).rejects.toThrow();
  });

  it("注入取消（外部 signal 已 abort）", async () => {
    const p = new MockProvider({ latencyMs: { min: 0, max: 1 } });
    p.setFailure({ callIndex: 1, kind: "cancel" });
    const c = new AbortController();
    c.abort();
    await expect(p.text2Image("test", c.signal)).rejects.toThrow();
  });

  it("外部 abort 在 fakeDelay 期间生效", async () => {
    const p = new MockProvider({ latencyMs: { min: 20, max: 20 } });
    const c = new AbortController();
    setTimeout(() => c.abort(), 5);
    await expect(p.text2Image("test", c.signal)).rejects.toThrow();
  });

  it("短描述返回 question，长描述返回 optimized", async () => {
    const p = new MockProvider({ latencyMs: { min: 0, max: 1 } });
    const short = await p.ask("海");
    expect(short.type).toBe("question");
    const long = await p.ask("我在深蓝色的海底看见一座发光的门");
    expect(long.type).toBe("optimized");
  });

  it("streamChat 逐字 yield", async () => {
    const p = new MockProvider({ latencyMs: { min: 0, max: 1 } });
    const chars: string[] = [];
    for await (const c of p.streamChat([{ role: "user", content: "test" }])) {
      chars.push(c);
    }
    expect(chars.join("")).toContain("细流式");
  });

  it("analyze 返回四段内容", async () => {
    const p = new MockProvider({ latencyMs: { min: 0, max: 1 } });
    const result = await p.analyze("梦境描述", {
      scene: "海洋",
      emotion: "宁静",
      elements: ["大海", "月亮"],
    });
    expect(result.visualEvidence.length).toBeGreaterThan(0);
    expect(result.dreamClues.length).toBeGreaterThan(0);
    expect(result.reflectionQuestions.length).toBeGreaterThan(0);
  });

  it("多次调用不留下残留状态", async () => {
    const p = new MockProvider({ latencyMs: { min: 0, max: 1 }, seed: 7 });
    for (let i = 0; i < 20; i++) {
      await p.text2Image(`prompt ${i}`);
      await p.generateSemanticTags("asset");
    }
    expect(p.events.length).toBe(40);
  });
});