// 探索提示词构造器
// 关键约束：把"暗区"理解为空间入口而非更暗的阴影
// 1. 这是镜头向选中区域深入或放大的新视角
// 2. 保留原场景的曝光关系、色彩和时间氛围
// 3. 揭示区域内部的空间、物体和细节
// 4. 除非用户明确要求，不把"暗"当成主体、不整体压暗画面
// 5. 用户补充内容优先于默认保护规则

const PROTECTION_RULES = [
  "这是镜头向选中区域深入或放大的新视角，不是重新生成的无关画面。",
  "保留原场景的曝光关系、整体色调和时间氛围；不要整体压暗或大幅改变光照方向。",
  "揭示选中区域内部的空间、物体和细节；如果该区域本身较暗，应展示其内部结构与可辨识元素，而非更暗的阴影。",
  "除非用户明确要求生成更暗的画面，否则不要以'更暗'为目标。",
];

export interface BuildExplorationPromptInput {
  elementName: string;
  region?: { x: number; y: number; width: number; height: number };
  userHint?: string;
  /** 用户是否明确说"更暗/黑暗/夜里" */
  userWantsDarker?: boolean;
}

export function buildExplorationPrompt(input: BuildExplorationPromptInput): string {
  const lines: string[] = [];
  lines.push(`聚焦元素：${input.elementName}`);
  if (input.region) {
    lines.push(
      `目标区域（图片归一化坐标）：x=${input.region.x.toFixed(2)} y=${input.region.y.toFixed(2)} w=${input.region.width.toFixed(2)} h=${input.region.height.toFixed(2)}`
    );
  }
  if (input.userHint?.trim()) {
    lines.push(`用户补充：${input.userHint.trim()}`);
  }
  // 保护规则始终附带（除非用户明确要更暗，则允许压暗）
  if (!input.userWantsDarker) {
    for (const rule of PROTECTION_RULES) {
      lines.push(rule);
    }
  } else {
    lines.push("用户明确要求画面变暗；可以营造更暗的氛围，但仍要保持内部细节可辨识。");
    for (const rule of PROTECTION_RULES.slice(0, 3)) {
      lines.push(rule);
    }
  }
  lines.push("输出一段中文画面描述，60-120 字，用于生成图像。");
  return lines.join("\n");
}

/**
 * 启发式判断用户文本是否包含"变暗"诉求。
 */
export function detectDarkerIntent(text: string | undefined): boolean {
  if (!text) return false;
  const keywords = [
    "更暗",
    "再暗",
    "再黑",
    "黑一点",
    "变暗",
    "黑暗",
    "夜里",
    "夜晚",
    "darker",
    "night",
  ];
  return keywords.some((k) => text.toLowerCase().includes(k));
}