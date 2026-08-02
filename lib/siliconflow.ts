// ===== SiliconFlow API 客户端（安全重构版）=====
// 变更：
// 1. 移除任意本地图片路径读取，仅接受 (assetId, signal) 或 data:URL
// 2. 所有 fetch 调用接收外部 signal，支持取消和超时
// 3. 使用 readAssetForProvider 从受控资产仓库读取图片

import type {
  AgentMessage,
  SemanticTags,
  ElementPosition,
  ElementRegion,
} from "@/types";
import { readAssetForProvider } from "./assets/server";

/** SiliconFlow API 基础地址 */
const BASE_URL = "https://api.siliconflow.cn/v1";

/** 默认模型配置（可通过环境变量覆盖） */
const IMAGE_MODEL = process.env.IMAGE_MODEL || "Tongyi-MAI/Z-Image-Turbo";
const IMAGE_EDIT_MODEL =
  process.env.IMAGE_EDIT_MODEL || "Qwen/Qwen-Image-Edit-2509";
export const VLM_MODEL = process.env.VLM_MODEL || "Qwen/Qwen3-VL-8B-Instruct";
const AGENT_MODEL = process.env.AGENT_MODEL || "Qwen/Qwen2.5-7B-Instruct";
export const AGENT_ASK_MODEL =
  process.env.AGENT_ASK_MODEL || "Qwen/Qwen2.5-7B-Instruct";
export const SUGGESTION_MODEL =
  process.env.SUGGESTION_MODEL || "Qwen/Qwen2.5-14B-Instruct";
export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "BAAI/bge-m3";

/** 图像生成默认尺寸 */
const DEFAULT_IMAGE_SIZE = "1024x1024";

/** 默认 provider 超时（毫秒） */
export const PROVIDER_TIMEOUTS = {
  text: 45_000,
  vlm: 60_000,
  image: 120_000,
};

function getApiKey(): string {
  const key = process.env.SILICONFLOW_API_KEY;
  if (!key) {
    throw new Error("未配置 SILICONFLOW_API_KEY 环境变量");
  }
  return key;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/** 构造带超时的 AbortSignal：外部 signal 与 timeout 任意一个触发即中止 */
export function withTimeout(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const propagate = () => {
    clearTimeout(timer);
    controller.abort();
  };
  if (signal) {
    if (signal.aborted) {
      propagate();
      return controller.signal;
    }
    signal.addEventListener("abort", propagate, { once: true });
  }
  // 监听自身的 abort 清理 timer
  controller.signal.addEventListener(
    "abort",
    () => clearTimeout(timer),
    { once: true }
  );
  return controller.signal;
}

async function handleApiError(response: Response, action: string): Promise<never> {
  let detail = "";
  try {
    const body = await response.json();
    detail = body?.message || body?.error || JSON.stringify(body);
  } catch {
    detail = await response.text().catch(() => "");
  }
  // 不回显 API key，绝不写入 detail
  throw new Error(
    `[SiliconFlow] ${action} 失败: ${response.status} ${response.statusText}${
      detail ? ` - ${sanitizeDetail(detail)}` : ""
    }`
  );
}

/** 清理错误详情中的敏感信息 */
function sanitizeDetail(text: string): string {
  return text.replace(/sk-[a-zA-Z0-9]+/g, "sk-***").slice(0, 200);
}

/**
 * 解析图片输入：接受 data:URL、https URL 或受控 assetId。
 * 业务调用方只能传这三种形式之一；禁止本地路径。
 */
export async function resolveImageForProvider(
  input: string,
  signal?: AbortSignal
): Promise<string> {
  if (input.startsWith("data:")) return input;
  if (input.startsWith("http://") || input.startsWith("https://")) return input;
  // 否则视为 assetId：从受控仓库读取
  return readAssetForProvider(input, signal);
}

/**
 * 从模型回复文本中提取 JSON 对象
 */
export function extractJson<T = unknown>(text: string): T {
  const trimmed = text.trim();
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    let depth = 0;
    const start = candidate.indexOf("{");
    if (start < 0) {
      throw new Error(`无法从模型回复中解析 JSON: ${text}`);
    }
    for (let i = start; i < candidate.length; i++) {
      if (candidate[i] === "{") depth++;
      else if (candidate[i] === "}") depth--;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1)) as T;
        } catch {
          break;
        }
      }
    }
    throw new Error(`无法从模型回复中解析 JSON: ${text}`);
  }
}

/** Text2Image —— 首次梦境生成 */
export async function text2Image(
  prompt: string,
  imageSize?: string,
  signal?: AbortSignal
): Promise<{ imageUrl: string }> {
  const model = IMAGE_MODEL.toLowerCase();
  const isFlux = model.includes("flux");
  const isZImage = model.includes("z-image");

  const body = isZImage
    ? {
        model: IMAGE_MODEL,
        prompt,
        image_size: imageSize || DEFAULT_IMAGE_SIZE,
        seed: Math.floor(Math.random() * 1_000_000),
      }
    : isFlux
      ? {
          model: IMAGE_MODEL,
          prompt,
          image_size: imageSize || DEFAULT_IMAGE_SIZE,
          batch_size: 1,
          num_inference_steps: 4,
          guidance_scale: 0,
        }
      : {
          model: IMAGE_MODEL,
          prompt,
          image_size: imageSize || DEFAULT_IMAGE_SIZE,
          batch_size: 1,
          num_inference_steps: 20,
          guidance_scale: 7.5,
        };

  const response = await fetch(`${BASE_URL}/images/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: withTimeout(signal, PROVIDER_TIMEOUTS.image),
  });

  if (!response.ok) {
    await handleApiError(response, "Text2Image 图像生成");
  }

  const data = await response.json();
  const imageUrl = data?.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error("[SiliconFlow] Text2Image 返回结果中未找到图像 URL");
  }
  return { imageUrl };
}

/** Img2Img —— 微调或探索 */
export async function img2Img(
  prompt: string,
  image: string,
  mode: "refine" | "explore",
  strength?: number,
  signal?: AbortSignal
): Promise<{ imageUrl: string }> {
  const imageInput = await resolveImageForProvider(image, signal);

  const finalStrength =
    typeof strength === "number" && strength >= 0 && strength <= 1
      ? strength
      : mode === "refine"
        ? 0.4
        : 0.6;

  const editModel = IMAGE_EDIT_MODEL.toLowerCase();
  const isQwenEdit =
    editModel.includes("qwen-image-edit") || editModel.includes("qwen-image-edit-2509");

  const body = isQwenEdit
    ? { model: IMAGE_EDIT_MODEL, prompt, image: imageInput }
    : {
        model: IMAGE_EDIT_MODEL,
        prompt,
        image: imageInput,
        image_size: DEFAULT_IMAGE_SIZE,
        batch_size: 1,
        num_inference_steps: 20,
        guidance_scale: 7.5,
        strength: finalStrength,
      };

  const response = await fetch(`${BASE_URL}/images/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: withTimeout(signal, PROVIDER_TIMEOUTS.image),
  });

  if (!response.ok) {
    await handleApiError(response, "Img2Img 图像编辑");
  }

  const data = await response.json();
  const imageUrl = data?.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error("[SiliconFlow] Img2Img 返回结果中未找到图像 URL");
  }
  return { imageUrl };
}

/** VLM —— 语义标签生成（含 elementPositions 0..1 归一化坐标） */
export async function generateSemanticTags(
  imageInput: string,
  signal?: AbortSignal
): Promise<SemanticTags> {
  const resolved = await resolveImageForProvider(imageInput, signal);

  const promptText =
    "请分析这张梦境图像，提取语义标签。返回纯 JSON（不要其他文字），格式为：" +
    '{"scene":"场景类型","emotion":"情绪基调","elements":["关键元素1","关键元素2"],"elementPositions":[{"name":"元素1","box":{"x":0.1,"y":0.1,"width":0.2,"height":0.2},"confidence":0.9}]}' +
    "\n其中 box 是 0..1 归一化坐标（x/y/width/height），表示元素在图片中的矩形区域。";

  const body = {
    model: VLM_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: resolved } },
          { type: "text", text: promptText },
        ],
      },
    ],
    max_tokens: 768,
    temperature: 0.3,
  };

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: withTimeout(signal, PROVIDER_TIMEOUTS.vlm),
  });

  if (!response.ok) {
    await handleApiError(response, "VLM 语义标签生成");
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("[SiliconFlow] VLM 语义标签生成未返回内容");
  }

  const tags = extractJson<SemanticTags & { elementPositions?: Array<{ name: string; box: { x: number; y: number; width: number; height: number }; confidence?: number }> }>(content);

  // 兼容旧版 region 字段
  type RawPos = { name?: string; region?: string; box?: { x: number; y: number; width: number; height: number }; confidence?: number };
  const validRegions = ["top", "bottom", "left", "right", "center"];
  const rawPositions: RawPos[] = Array.isArray(tags.elementPositions)
    ? (tags.elementPositions as RawPos[])
    : [];

  const elementPositions: ElementPosition[] = rawPositions
    .filter((p) => p && typeof p.name === "string")
    .map((p) => {
      if (p.box && typeof p.box.x === "number") {
        // 使用 box 字段时把它转写为 region 名称（如 "object"）
        return {
          name: p.name!,
          region: "center" as ElementRegion,
        };
      }
      // 旧字段 region 转换
      const region = p.region;
      if (typeof region === "string" && validRegions.includes(region)) {
        return {
          name: p.name!,
          region: region as ElementRegion,
        };
      }
      return null;
    })
    .filter((p): p is ElementPosition => p !== null);

  return {
    scene: tags.scene || "未知场景",
    emotion: tags.emotion || "未知情绪",
    elements: Array.isArray(tags.elements) ? tags.elements : [],
    elementPositions,
  };
}

/** VLM —— 元素识别（点击探索时使用） */
export async function identifyElement(
  imageInput: string,
  clickX: number,
  clickY: number,
  signal?: AbortSignal
): Promise<{ element: string }> {
  const resolved = await resolveImageForProvider(imageInput, signal);

  const promptText =
    `用户在这张图像的归一化坐标 (${clickX.toFixed(3)}, ${clickY.toFixed(3)}) 处点击了一下。` +
    "请识别该位置最主要的目标元素（一个简短的名词）。" +
    '返回纯 JSON（不要其他文字），格式为：{"element":"元素名称"}';

  const body = {
    model: VLM_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: resolved } },
          { type: "text", text: promptText },
        ],
      },
    ],
    max_tokens: 128,
    temperature: 0.2,
  };

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: withTimeout(signal, PROVIDER_TIMEOUTS.vlm),
  });

  if (!response.ok) {
    await handleApiError(response, "VLM 元素识别");
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("[SiliconFlow] VLM 元素识别未返回内容");
  }

  const result = extractJson<{ element: string }>(content);
  return { element: result.element || "未知元素" };
}

/** Chat —— 流式输出 */
export async function* chatStream(
  messages: AgentMessage[],
  model?: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const body = {
    model: model || AGENT_MODEL,
    messages,
    stream: true,
  };

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: withTimeout(signal, PROVIDER_TIMEOUTS.text),
  });

  if (!response.ok) {
    await handleApiError(response, "Chat 流式对话");
  }

  if (!response.body) {
    throw new Error("[SiliconFlow] Chat 流式对话未返回响应体");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Agent —— 非流式对话 */
export async function chat(
  messages: AgentMessage[],
  model?: string,
  signal?: AbortSignal
): Promise<string> {
  const body = {
    model: model || AGENT_MODEL,
    messages,
    stream: false,
  };

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: withTimeout(signal, PROVIDER_TIMEOUTS.text),
  });

  if (!response.ok) {
    await handleApiError(response, "Agent 对话");
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("[SiliconFlow] Agent 对话未返回内容");
  }
  return content;
}

/** EmbedText —— 文本向量化 */
export async function embedText(
  text: string,
  signal?: AbortSignal
): Promise<number[]> {
  const trimmed = (text || "").trim();
  if (!trimmed) return [];

  const body = {
    model: EMBEDDING_MODEL,
    input: trimmed,
    encoding_format: "float",
  };

  const response = await fetch(`${BASE_URL}/embeddings`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: withTimeout(signal, PROVIDER_TIMEOUTS.text),
  });

  if (!response.ok) {
    await handleApiError(response, "Embedding 文本向量化");
  }

  const data = await response.json();
  const vector: unknown = data?.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("[SiliconFlow] Embedding 返回结果中未找到向量");
  }
  return vector as number[];
}

/** EmbedTextBatch —— 批量向量化 */
export async function embedTextBatch(
  texts: string[],
  signal?: AbortSignal
): Promise<number[][]> {
  const valid = texts.map((t) => (t || "").trim()).filter((t) => t.length > 0);
  if (valid.length === 0) return [];

  const body = {
    model: EMBEDDING_MODEL,
    input: valid,
    encoding_format: "float",
  };

  const response = await fetch(`${BASE_URL}/embeddings`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: withTimeout(signal, PROVIDER_TIMEOUTS.text),
  });

  if (!response.ok) {
    await handleApiError(response, "Embedding 批量向量化");
  }

  const data = await response.json();
  const list: unknown = data?.data;
  if (!Array.isArray(list)) {
    throw new Error("[SiliconFlow] Embedding 批量返回结果格式异常");
  }
  return list
    .sort((a: { index?: number }, b: { index?: number }) =>
      (a.index ?? 0) < (b.index ?? 0) ? -1 : 1
    )
    .map((item: { embedding?: number[] }) => {
      if (!Array.isArray(item.embedding)) {
        throw new Error("[SiliconFlow] Embedding 批量返回条目缺少 embedding 字段");
      }
      return item.embedding;
    });
}