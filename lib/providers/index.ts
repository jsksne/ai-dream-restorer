// Provider 工厂：根据环境变量决定使用 live / mock / demo
// 测试环境下默认强制使用 mock，不允许意外访问 SiliconFlow

import * as real from "../siliconflow";
import { MockProvider } from "./mock-provider";
import type { ProviderProvider } from "./types";

let _instance: ProviderProvider | null = null;

export function getProvider(): ProviderProvider {
  if (_instance) return _instance;
  // 测试环境：强制 mock
  const isVitest = typeof process !== "undefined" && process.env?.VITEST === "true";
  // 用户显式选择 demo 模式
  if (process.env.ONEIRA_PROVIDER_MODE === "demo") {
    _instance = new MockProvider({ seed: 1 });
    return _instance;
  }
  // 测试环境或 ONEIRA_PROVIDER_MODE=mock
  if (isVitest || process.env.ONEIRA_PROVIDER_MODE === "mock") {
    _instance = new MockProvider({ seed: 1 });
    return _instance;
  }
  // 真实模式：包装 siliconflow 调用
  _instance = createLiveProvider();
  return _instance;
}

export function resetProviderForTest(): void {
  _instance = null;
}

function createLiveProvider(): ProviderProvider {
  return {
    mode: "live",
    async text2Image(prompt, signal) {
      const out = await real.text2Image(prompt, undefined, signal);
      return { imageUrl: out.imageUrl };
    },
    async img2Img(prompt, image, mode, signal) {
      const out = await real.img2Img(prompt, image, mode, undefined, signal);
      return { imageUrl: out.imageUrl };
    },
    async generateSemanticTags(image, signal) {
      const result = await real.generateSemanticTags(image, signal);
      const positions = (result.elementPositions ?? []).map((p) => ({
        name: p.name,
        box: { x: 0, y: 0, width: 1, height: 1 },
        confidence: 0.5,
      }));
      return {
        scene: result.scene,
        emotion: result.emotion,
        elements: result.elements,
        elementPositions: positions,
      };
    },
    async identifyElement(image, x, y, signal) {
      return await real.identifyElement(image, x, y, signal);
    },
    async ask(prompt, signal) {
      const result = await real.chat(
        [
          {
            role: "system",
            content:
              "你是梦境描述优化助手。短描述返回 question；长描述返回 optimized 摘要。返回 JSON。",
          },
          { role: "user", content: prompt },
        ],
        undefined,
        signal
      );
      try {
        return real.extractJson<{
          type: "question" | "optimized";
          question?: string;
          optimizedDescription?: string;
        }>(result);
      } catch {
        return { type: "optimized", optimizedDescription: prompt };
      }
    },
    async chat(messages, signal) {
      return await real.chat(
        messages.map((m) => ({ role: m.role as "system" | "user" | "assistant" | "tool", content: m.content })),
        undefined,
        signal
      );
    },
    async *streamChat(messages, signal) {
      for await (const delta of real.chatStream(
        messages.map((m) => ({ role: m.role as "system" | "user" | "assistant" | "tool", content: m.content })),
        undefined,
        signal
      )) {
        yield delta;
      }
    },
    async analyze(description, tags, signal) {
      // 真实分析应该走 VLM 证据 + 文本综合；这里占位调用 chat
      const evidence = await real.generateSemanticTags(
        "data:image/png;base64,placeholder",
        signal
      );
      const chatMessages = [
        {
          role: "system" as const,
          content:
            "你是梦境分析助手。基于视觉证据和原始描述，给出非诊断性线索。返回 JSON：{visualEvidence, dreamClues, emotionalThread, possibleConnections, reflectionQuestions}。",
        },
        {
          role: "user" as const,
          content: `描述：${description}\n标签：${JSON.stringify(tags)}\n证据：${JSON.stringify(evidence)}`,
        },
      ];
      const text = await real.chat(chatMessages, undefined, signal);
      try {
        return real.extractJson<{
          visualEvidence: Array<{ observation: string; confidence: number }>;
          dreamClues: string;
          emotionalThread: string;
          possibleConnections: string;
          reflectionQuestions: string[];
        }>(text);
      } catch {
        return {
          visualEvidence: [],
          dreamClues: "无法解析分析结果",
          emotionalThread: "",
          possibleConnections: "",
          reflectionQuestions: [],
        };
      }
    },
  };
}