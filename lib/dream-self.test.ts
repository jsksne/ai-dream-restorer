import { describe, it, expect } from "vitest";
import {
  computeInclusion,
  planDreamSelfDeletion,
  validateDreamSelfInput,
} from "./dream-self";
import type { DreamSelfProfile, DreamProject } from "./project-storage";

const profile: DreamSelfProfile = {
  id: "p1",
  name: "测试形象",
  description: "长发女生",
  referenceAssetId: null,
  canonicalAssetId: "asset-1",
  signatureTraits: ["长发", "白裙"],
  approvedAt: "2026-01-01",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

const emptyProfile: DreamSelfProfile = {
  id: "p2",
  name: "未批准",
  description: "",
  referenceAssetId: null,
  canonicalAssetId: null,
  signatureTraits: [],
  approvedAt: null,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

describe("computeInclusion", () => {
  it("first-person 只包含文本特征，不发送图片", () => {
    const out = computeInclusion("first-person", profile);
    expect(out.includeImage).toBe(false);
    expect(out.includeTextTraits).toBe(true);
    expect(out.traits).toEqual(["长发", "白裙"]);
  });

  it("third-person 包含图片和文本", () => {
    const out = computeInclusion("third-person", profile);
    expect(out.includeImage).toBe(true);
    expect(out.includeTextTraits).toBe(true);
  });

  it("observer-without-self 完全不发送 Dream Self", () => {
    const out = computeInclusion("observer-without-self", profile);
    expect(out.includeImage).toBe(false);
    expect(out.includeTextTraits).toBe(false);
    expect(out.traits).toEqual([]);
  });

  it("未批准档案完全禁用", () => {
    const out = computeInclusion("third-person", emptyProfile);
    expect(out.includeImage).toBe(false);
    expect(out.includeTextTraits).toBe(false);
  });
});

describe("planDreamSelfDeletion", () => {
  it("未被引用的档案归入 safe", () => {
    const projects: DreamProject[] = [];
    const { safe, referenced } = planDreamSelfDeletion([profile], projects);
    expect(safe.length).toBe(1);
    expect(referenced.length).toBe(0);
  });

  it("被项目引用的档案保留", () => {
    const projects: DreamProject[] = [
      {
        schemaVersion: 2,
        id: "proj-1",
        title: "t",
        originalDescription: "d",
        refinedPrompt: "d",
        perspective: "first-person",
        activeDreamSelfId: "p1",
        rootNodeId: null,
        activeNodeId: null,
        nodes: {},
        versions: [],
        selectedVersionId: null,
        analysis: null,
        assetIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const { safe, referenced } = planDreamSelfDeletion([profile], projects);
    expect(safe.length).toBe(0);
    expect(referenced.length).toBe(1);
  });
});

describe("validateDreamSelfInput", () => {
  it("合法输入通过", () => {
    const out = validateDreamSelfInput({
      name: "测试",
      description: "描述",
      signatureTraits: ["a"],
    });
    expect(out.ok).toBe(true);
  });

  it("缺名称拒绝", () => {
    const out = validateDreamSelfInput({
      name: "",
      description: "d",
      signatureTraits: [],
    });
    expect(out.ok).toBe(false);
  });

  it("null 拒绝", () => {
    expect(validateDreamSelfInput(null).ok).toBe(false);
  });

  it("name 超长截断", () => {
    const out = validateDreamSelfInput({
      name: "a".repeat(100),
      description: "x",
      signatureTraits: [],
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.profile.name?.length).toBeLessThanOrEqual(40);
  });
});