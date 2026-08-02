// Dream Self 工具与隐私保护
// 1. 选择规则：
//   - first-person：只注入可见特征文字描述（不发送图片）
//   - third-person：携带 canonical 资产作为编辑参考
//   - observer-without-self：不发送任何 Dream Self 资产
// 2. 未激活档案的资产不应进入请求体
// 3. 删除全部形象数据时检查项目引用

import type { DreamSelfProfile, DreamProject } from "./project-storage";
import type { DreamPerspective } from "@/types";

export interface DreamSelfInclusion {
  includeImage: boolean;
  includeTextTraits: boolean;
  traits: string[];
  description: string;
}

/**
 * 根据当前视角计算 Dream Self 应该被如何注入
 */
export function computeInclusion(
  perspective: DreamPerspective,
  profile: DreamSelfProfile | null
): DreamSelfInclusion {
  if (!profile || !profile.canonicalAssetId) {
    return { includeImage: false, includeTextTraits: false, traits: [], description: "" };
  }
  const baseTraits = profile.signatureTraits ?? [];
  switch (perspective) {
    case "first-person":
      return {
        includeImage: false,
        includeTextTraits: true,
        traits: baseTraits,
        description: profile.description,
      };
    case "third-person":
      return {
        includeImage: true,
        includeTextTraits: true,
        traits: baseTraits,
        description: profile.description,
      };
    case "observer-without-self":
      return {
        includeImage: false,
        includeTextTraits: false,
        traits: [],
        description: "",
      };
    default:
      return { includeImage: false, includeTextTraits: false, traits: [], description: "" };
  }
}

/**
 * 删除全部 Dream Self 数据：检查所有项目是否仍引用这些档案。
 * 返回被实际删除的档案 ID 列表和被项目引用的档案 ID 列表（后者不删）。
 */
export function planDreamSelfDeletion(
  profiles: DreamSelfProfile[],
  projects: DreamProject[]
): { safe: DreamSelfProfile[]; referenced: DreamSelfProfile[] } {
  const referencedIds = new Set<string>();
  for (const p of projects) {
    if (p.activeDreamSelfId) referencedIds.add(p.activeDreamSelfId);
  }
  const safe: DreamSelfProfile[] = [];
  const referenced: DreamSelfProfile[] = [];
  for (const profile of profiles) {
    if (referencedIds.has(profile.id)) referenced.push(profile);
    else safe.push(profile);
  }
  return { safe, referenced };
}

/**
 * 校验新 Dream Self 档案的输入
 */
export function validateDreamSelfInput(input: unknown): { ok: true; profile: Partial<DreamSelfProfile> } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "输入无效" };
  const i = input as Partial<DreamSelfProfile>;
  if (typeof i.name !== "string" || i.name.trim().length === 0) {
    return { ok: false, error: "档案名称必填" };
  }
  if (typeof i.description !== "string") {
    return { ok: false, error: "档案描述必填" };
  }
  if (!Array.isArray(i.signatureTraits)) {
    return { ok: false, error: "标志性特征必须是字符串数组" };
  }
  return {
    ok: true,
    profile: {
      name: i.name.trim().slice(0, 40),
      description: i.description.slice(0, 500),
      signatureTraits: i.signatureTraits.map((s: unknown) => String(s).slice(0, 40)),
    },
  };
}