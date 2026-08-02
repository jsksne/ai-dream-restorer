// Provider 抽象层类型定义
// 把真实 SiliconFlow API 与测试 Mock 解耦；提供 mock / live / demo 三种模式

export type ProviderMode = "live" | "mock" | "demo";

export interface ProviderOptions {
  mode?: ProviderMode;
  /** 用于可重现测试的种子 */
  seed?: number;
  /** 模拟的延迟范围（毫秒） */
  latencyMs?: { min: number; max: number };
  /** 触发错误的概率（0-1） */
  errorRate?: number;
}

export interface ProviderImageResult {
  imageUrl: string;
}

export interface ProviderTagsResult {
  scene: string;
  emotion: string;
  elements: string[];
  elementPositions?: Array<{ name: string; box: { x: number; y: number; width: number; height: number }; confidence: number }>;
}

export interface ProviderAskResult {
  type: "question" | "optimized";
  question?: string;
  optimizedDescription?: string;
}

export interface ProviderProvider {
  readonly mode: ProviderMode;

  text2Image(prompt: string, signal?: AbortSignal): Promise<ProviderImageResult>;
  img2Img(
    prompt: string,
    imageInput: string,
    mode: "refine" | "explore",
    signal?: AbortSignal
  ): Promise<ProviderImageResult>;
  generateSemanticTags(
    imageInput: string,
    signal?: AbortSignal
  ): Promise<ProviderTagsResult>;
  identifyElement(
    imageInput: string,
    clickX: number,
    clickY: number,
    signal?: AbortSignal
  ): Promise<{ element: string }>;
  ask(prompt: string, signal?: AbortSignal): Promise<ProviderAskResult>;
  chat(messages: Array<{ role: string; content: string }>, signal?: AbortSignal): Promise<string>;
  streamChat(
    messages: Array<{ role: string; content: string }>,
    signal?: AbortSignal
  ): AsyncGenerator<string>;
  analyze(
    description: string,
    tags: { scene: string; emotion: string; elements: string[] },
    signal?: AbortSignal
  ): Promise<{ visualEvidence: Array<{ observation: string; confidence: number }>; dreamClues: string; emotionalThread: string; possibleConnections: string; reflectionQuestions: string[] }>;
}