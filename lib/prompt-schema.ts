// 提示词智能体协议 schema
// 隐藏槽位 + 单点追问 + 风格始终可见 + 最多 3 轮
// 选项 2-4 个；自由输入可附加

export const PROMPT_SLOTS = [
  "time",
  "place",
  "characters",
  "perspective",
  "emotion",
  "event",
  "sensory",
  "style",
  "dreamSelf",
] as const;

export type PromptSlot = (typeof PROMPT_SLOTS)[number];

export interface PromptCoachOption {
  id: string;
  label: string;
  value: string;
}

export interface PromptCoachReply {
  /** 是否可立即生成 */
  ready: boolean;
  /** 当前追问问题；ready=true 时为 null */
  question: string | null;
  /** 追问针对的槽位；ready=true 时为 null */
  targetSlot: PromptSlot | null;
  /** 候选选项（2-4 个） */
  options: PromptCoachOption[];
  /** 是否允许自由输入 */
  allowFreeText: boolean;
  /** 当前摘要（可编辑） */
  summary: string;
  /** 推荐风格（始终可编辑） */
  recommendedStyle: string;
  /** 仍缺少的高影响槽位（仅展示用） */
  missingHighImpactSlots: PromptSlot[];
  /** 当前轮次（0-based；>3 强制 ready） */
  round: number;
}

const MAX_OPTIONS = 4;
const MIN_OPTIONS = 2;
const MAX_ROUNDS = 3;

/**
 * 严格校验 PromptCoachReply。失败时返回安全 fallback。
 */
export function validatePromptCoachReply(input: unknown): PromptCoachReply {
  const fallback: PromptCoachReply = {
    ready: true,
    question: null,
    targetSlot: null,
    options: [],
    allowFreeText: true,
    summary: "",
    recommendedStyle: "电影感",
    missingHighImpactSlots: [],
    round: 0,
  };
  if (!input || typeof input !== "object") return fallback;
  const i = input as Record<string, unknown>;
  // round
  const round = typeof i.round === "number" ? Math.max(0, Math.min(MAX_ROUNDS, i.round)) : 0;
  const ready = typeof i.ready === "boolean" ? i.ready : true;
  // summary
  const summary = typeof i.summary === "string" ? i.summary.slice(0, 500) : "";
  const recommendedStyle = typeof i.recommendedStyle === "string" ? i.recommendedStyle.slice(0, 100) : "电影感";
  // options 2-4
  const rawOptions = Array.isArray(i.options) ? i.options : [];
  const options: PromptCoachOption[] = [];
  for (const o of rawOptions) {
    if (!o || typeof o !== "object") continue;
    const obj = o as { id?: unknown; label?: unknown; value?: unknown };
    if (
      typeof obj.id === "string" &&
      typeof obj.label === "string" &&
      typeof obj.value === "string" &&
      obj.label.length > 0 &&
      obj.value.length > 0
    ) {
      options.push({
        id: obj.id.slice(0, 40),
        label: obj.label.slice(0, 80),
        value: obj.value.slice(0, 200),
      });
    }
    if (options.length >= MAX_OPTIONS) break;
  }
  // targetSlot
  const targetSlot =
    typeof i.targetSlot === "string" && (PROMPT_SLOTS as readonly string[]).includes(i.targetSlot)
      ? (i.targetSlot as PromptSlot)
      : null;
  // question: ready=false 时必须存在
  const question = typeof i.question === "string" ? i.question.slice(0, 200) : null;
  // ready 规则：超过 3 轮强制 ready；选项不足 2 个时强制追问失败但允许 ready=false
  let finalReady = ready;
  if (round >= MAX_ROUNDS) finalReady = true;
  if (finalReady) {
    return {
      ready: true,
      question: null,
      targetSlot: null,
      options: [],
      allowFreeText: false,
      summary,
      recommendedStyle,
      missingHighImpactSlots: [],
      round,
    };
  }
  // ready=false 时必须有 question 和 options 2-4
  if (!question || options.length < MIN_OPTIONS) {
    // 不可恢复：升级为 ready=true
    return {
      ready: true,
      question: null,
      targetSlot: null,
      options: [],
      allowFreeText: false,
      summary,
      recommendedStyle,
      missingHighImpactSlots: [],
      round,
    };
  }
  const allowFreeText = typeof i.allowFreeText === "boolean" ? i.allowFreeText : true;
  const missingHighImpactSlots = Array.isArray(i.missingHighImpactSlots)
    ? i.missingHighImpactSlots.filter(
        (s): s is PromptSlot =>
          typeof s === "string" && (PROMPT_SLOTS as readonly string[]).includes(s)
      )
    : [];
  return {
    ready: finalReady,
    question,
    targetSlot,
    options,
    allowFreeText,
    summary,
    recommendedStyle,
    missingHighImpactSlots,
    round,
  };
}

/** 默认风格候选 */
export const DEFAULT_STYLES = [
  { id: "cartoon", label: "卡通", value: "卡通插画风格" },
  { id: "oil", label: "油画", value: "油画质感" },
  { id: "watercolor", label: "水彩", value: "水彩晕染" },
  { id: "sketch", label: "素描", value: "铅笔素描" },
  { id: "cinematic", label: "电影感", value: "电影感画面" },
  { id: "surreal", label: "超现实", value: "超现实主义" },
] as const satisfies ReadonlyArray<PromptCoachOption>;