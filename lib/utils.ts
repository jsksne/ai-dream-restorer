import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** 合并 Tailwind CSS 类名 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 生成唯一 ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 格式化时间戳 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 延迟函数 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 检查描述是否模糊（少于10字或缺场景细节） */
export function isVagueDescription(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 10) return true;
  const sceneKeywords = ["梦", "看到", "看见", "在", "里有", "上有", "下有", "梦见"];
  return !sceneKeywords.some((kw) => trimmed.includes(kw));
}

/** 获取链路深度提示 */
export function getDepthWarning(depth: number, type: "refine" | "explore"): string | null {
  if (type === "refine" && depth >= 5) {
    return "当前链路过深，细节可能漂移，建议从较早版本重新开始以获得更好效果";
  }
  if (type === "explore" && depth >= 7) {
    return "梦境已经很深了";
  }
  return null;
}
