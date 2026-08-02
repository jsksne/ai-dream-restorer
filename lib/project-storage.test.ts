// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  validateProject,
  __resetDbForTest,
  type DreamProject,
} from "./project-storage";

const sampleProject = (): DreamProject => ({
  schemaVersion: 2,
  id: "proj-1",
  title: "测试梦境",
  originalDescription: "梦见大海",
  refinedPrompt: "梦见大海（氛围增强）",
  perspective: "first-person",
  activeDreamSelfId: null,
  rootNodeId: "n1",
  activeNodeId: "n1",
  nodes: {
    n1: {
      id: "n1",
      parentId: null,
      childIds: ["n2", "n3"],
      assetId: "11111111-1111-1111-1111-111111111111",
      prompt: "大海",
      branchLabel: "海面",
      origin: "remembered",
      sceneRegions: [
        { id: "r1", label: "月亮", box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }, confidence: 0.9 },
      ],
      createdAt: new Date().toISOString(),
    },
    n2: {
      id: "n2",
      parentId: "n1",
      childIds: [],
      assetId: "22222222-2222-2222-2222-222222222222",
      prompt: "深入",
      branchLabel: "分支1",
      origin: "ai-exploration",
      sceneRegions: [],
      createdAt: new Date().toISOString(),
    },
    n3: {
      id: "n3",
      parentId: "n1",
      childIds: [],
      assetId: "33333333-3333-3333-3333-333333333333",
      prompt: "深入",
      branchLabel: "分支2",
      origin: "ai-exploration",
      sceneRegions: [],
      createdAt: new Date().toISOString(),
    },
  },
  versions: [
    { id: "v1", nodeId: "n1", title: "海面", isClosest: true, createdAt: new Date().toISOString() },
  ],
  selectedVersionId: "v1",
  analysis: null,
  assetIds: [
    "11111111-1111-1111-1111-111111111111",
    "22222222-2222-2222-2222-222222222222",
    "33333333-3333-3333-3333-333333333333",
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe("validateProject", () => {
  beforeEach(() => __resetDbForTest());

  it("合法项目通过验证", () => {
    const result = validateProject(sampleProject());
    expect(result).not.toBeNull();
  });

  it("schemaVersion 不为 2 拒绝", () => {
    const p = { ...sampleProject(), schemaVersion: 1 } as unknown as DreamProject;
    expect(validateProject(p)).toBeNull();
  });

  it("缺 id 拒绝", () => {
    const p = { ...sampleProject(), id: "" } as unknown as DreamProject;
    expect(validateProject(p)).toBeNull();
  });

  it("非法 perspective 拒绝", () => {
    const p = {
      ...sampleProject(),
      perspective: "wrong" as unknown as DreamProject["perspective"],
    } as DreamProject;
    expect(validateProject(p)).toBeNull();
  });

  it("null 输入返回 null", () => {
    expect(validateProject(null)).toBeNull();
    expect(validateProject("string")).toBeNull();
    expect(validateProject({})).toBeNull();
  });

  it("versions 不是数组拒绝", () => {
    const p = {
      ...sampleProject(),
      versions: "not array" as unknown as DreamProject["versions"],
    } as DreamProject;
    expect(validateProject(p)).toBeNull();
  });

  it("三个合法视角都被接受", () => {
    for (const perspective of ["first-person", "third-person", "observer-without-self"] as const) {
      const p = { ...sampleProject(), perspective };
      expect(validateProject(p)).not.toBeNull();
    }
  });
});