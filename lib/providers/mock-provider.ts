// Mock Provider：在测试环境提供可重现、可注入错误的 provider 实现
// - 固定种子决定事件序列
// - 可配置延迟区间
// - 可注入 429/500/timeout/cancel 场景
// - 永不发起到 SiliconFlow 的真实网络请求

import type {
  ProviderMode,
  ProviderOptions,
  ProviderImageResult,
  ProviderTagsResult,
  ProviderAskResult,
  ProviderProvider,
} from "./types";

/** 简易 PRNG（mulberry32） */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type MockFailureKind = "timeout" | "429" | "500" | "cancel";

export interface MockFailureSpec {
  /** 在第几次调用后触发失败（1-based）；不传表示不触发 */
  callIndex?: number;
  kind: MockFailureKind;
}

export class MockProvider implements ProviderProvider {
  readonly mode: ProviderMode = "mock";
  private rng: () => number;
  private callCount = 0;
  private latency = { min: 5, max: 30 };
  private errorRate = 0;
  private failure: MockFailureSpec | null = null;
  /** 事件回调（按调用顺序触发，用于阶段进度） */
  public events: Array<{ name: string; ts: number }> = [];

  constructor(opts: ProviderOptions = {}) {
    this.rng = makeRng(opts.seed ?? 1);
    if (opts.latencyMs) {
      this.latency = { ...opts.latencyMs };
    }
    if (typeof opts.errorRate === "number") {
      this.errorRate = Math.max(0, Math.min(1, opts.errorRate));
    }
  }

  setFailure(spec: MockFailureSpec | null): void {
    this.failure = spec;
  }

  private async fakeDelay(signal?: AbortSignal): Promise<void> {
    const ms =
      this.latency.min + Math.floor(this.rng() * (this.latency.max - this.latency.min));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      if (signal) {
        const onAbort = () => {
          clearTimeout(timer);
          const e = new Error("aborted");
          e.name = "AbortError";
          reject(e);
        };
        if (signal.aborted) {
          clearTimeout(timer);
          const e = new Error("aborted");
          e.name = "AbortError";
          reject(e);
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      }
    });
  }

  private bumpAndMaybeFail(signal?: AbortSignal): void {
    this.callCount++;
    this.events.push({ name: `call-${this.callCount}`, ts: Date.now() });
    if (this.failure && this.failure.callIndex === this.callCount) {
      switch (this.failure.kind) {
        case "timeout":
          throw new Error("模拟超时");
        case "429":
          throw new Error("[MockProvider] 429 Too Many Requests");
        case "500":
          throw new Error("[MockProvider] 500 Internal Server Error");
        case "cancel":
          if (signal) {
            try {
              signal.throwIfAborted?.();
            } catch (e) {
              throw e;
            }
            // fallback：手动抛 abort
            throw new Error("aborted");
          }
      }
    }
    if (this.errorRate > 0 && this.rng() < this.errorRate) {
      throw new Error("[MockProvider] 随机错误");
    }
  }

  async text2Image(prompt: string, signal?: AbortSignal): Promise<ProviderImageResult> {
    await this.fakeDelay(signal);
    this.bumpAndMaybeFail(signal);
    return {
      imageUrl: `/api/mock-assets/dream_${this.callCount}.png`,
    };
  }

  async img2Img(
    prompt: string,
    _image: string,
    _mode: "refine" | "explore",
    signal?: AbortSignal
  ): Promise<ProviderImageResult> {
    await this.fakeDelay(signal);
    this.bumpAndMaybeFail(signal);
    return {
      imageUrl: `/api/mock-assets/branch_${this.callCount}.png`,
    };
  }

  async generateSemanticTags(_image: string, signal?: AbortSignal): Promise<ProviderTagsResult> {
    await this.fakeDelay(signal);
    this.bumpAndMaybeFail(signal);
    return {
      scene: "梦境空间",
      emotion: "宁静",
      elements: ["月亮", "大海", "门"],
      elementPositions: [
        { name: "月亮", box: { x: 0.4, y: 0.05, width: 0.2, height: 0.2 }, confidence: 0.9 },
        { name: "大海", box: { x: 0.0, y: 0.5, width: 1.0, height: 0.4 }, confidence: 0.85 },
        { name: "门", box: { x: 0.7, y: 0.6, width: 0.15, height: 0.35 }, confidence: 0.7 },
      ],
    };
  }

  async identifyElement(
    _image: string,
    clickX: number,
    clickY: number,
    signal?: AbortSignal
  ): Promise<{ element: string }> {
    await this.fakeDelay(signal);
    this.bumpAndMaybeFail(signal);
    const x = Math.round(clickX * 100);
    const y = Math.round(clickY * 100);
    return { element: `坐标(${x},${y})的元素` };
  }

  async ask(prompt: string, signal?: AbortSignal): Promise<ProviderAskResult> {
    await this.fakeDelay(signal);
    this.bumpAndMaybeFail(signal);
    if (prompt.trim().length < 10) {
      return { type: "question", question: "能再详细描述一下你的梦境吗？" };
    }
    return { type: "optimized", optimizedDescription: `${prompt}（氛围增强）` };
  }

  async chat(messages: Array<{ role: string; content: string }>, signal?: AbortSignal): Promise<string> {
    await this.fakeDelay(signal);
    this.bumpAndMaybeFail(signal);
    return "这是一个温和的提示回答。";
  }

  async *streamChat(
    messages: Array<{ role: string; content: string }>,
    signal?: AbortSignal
  ): AsyncGenerator<string> {
    await this.fakeDelay(signal);
    this.bumpAndMaybeFail(signal);
    const text = "这是一个细流式回答片段";
    for (const c of text) {
      if (signal?.aborted) return;
      yield c;
    }
  }

  async analyze(
    description: string,
    tags: { scene: string; emotion: string; elements: string[] },
    signal?: AbortSignal
  ): Promise<{
    visualEvidence: Array<{ observation: string; confidence: number }>;
    dreamClues: string;
    emotionalThread: string;
    possibleConnections: string;
    reflectionQuestions: string[];
  }> {
    await this.fakeDelay(signal);
    this.bumpAndMaybeFail(signal);
    return {
      visualEvidence: [
        { observation: `画面中有 ${tags.elements.join("、")}`, confidence: 0.8 },
        { observation: `场景氛围：${tags.emotion}`, confidence: 0.7 },
      ],
      dreamClues: "这是梦境线索的多模态证据。",
      emotionalThread: "情绪脉络的非诊断性观察。",
      possibleConnections: "可能的现实联想，但仅作为参考。",
      reflectionQuestions: ["可以留意这个画面想说什么？"],
    };
  }
}