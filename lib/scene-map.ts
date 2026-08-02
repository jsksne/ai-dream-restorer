// 场景区域图（Scene Map）验证与规范化
// 来自 VLM 的响应需要规范化、过滤越界和低置信度的区域

export interface SceneRegionInput {
  id?: string;
  label: string;
  box: { x: number; y: number; width: number; height: number };
  confidence?: number;
}

export interface NormalizedSceneRegion {
  id: string;
  label: string;
  box: { x: number; y: number; width: number; height: number };
  confidence: number;
}

/**
 * 校验并规范化 scene map。返回过滤后的有效区域数组。
 * - 区域面积 < 0.5% 视为噪点
 * - 区域面积 > 50% 视为容器错误
 * - 置信度 < 0.3 视为不可信
 * - box 越界 [0,1] 裁剪到 [0,1]
 * - 数量上限 8
 */
export function validateSceneMap(
  input: unknown,
  opts: { maxRegions?: number } = {}
): NormalizedSceneRegion[] {
  const max = opts.maxRegions ?? 8;
  if (!Array.isArray(input)) return [];
  const result: NormalizedSceneRegion[] = [];
  for (const item of input as SceneRegionInput[]) {
    if (!item || typeof item !== "object") continue;
    if (typeof item.label !== "string" || item.label.trim().length === 0) {
      continue;
    }
    const box = clampBox(item.box);
    if (!box) continue;
    const area = box.width * box.height;
    if (area < 0.005 || area > 0.5) continue;
    const conf = typeof item.confidence === "number" ? item.confidence : 0.5;
    if (conf < 0.3) continue;
    result.push({
      id: typeof item.id === "string" && item.id.trim().length > 0
        ? item.id
        : `region-${result.length}`,
      label: item.label.trim().slice(0, 40),
      box,
      confidence: conf,
    });
    if (result.length >= max) break;
  }
  return result;
}

function clampBox(box: unknown): { x: number; y: number; width: number; height: number } | null {
  if (!box || typeof box !== "object") return null;
  const b = box as { x?: number; y?: number; width?: number; height?: number };
  if (
    typeof b.x !== "number" ||
    typeof b.y !== "number" ||
    typeof b.width !== "number" ||
    typeof b.height !== "number"
  ) {
    return null;
  }
  const x = Math.max(0, Math.min(1, b.x));
  const y = Math.max(0, Math.min(1, b.y));
  let width = Math.max(0, Math.min(1, b.width));
  let height = Math.max(0, Math.min(1, b.height));
  if (x + width > 1) width = 1 - x;
  if (y + height > 1) height = 1 - y;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}