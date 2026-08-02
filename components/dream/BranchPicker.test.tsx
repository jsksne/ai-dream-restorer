// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BranchPicker } from "./BranchPicker";
import type { DreamNode } from "@/lib/project-storage";

afterEach(cleanup);

const parent: DreamNode = {
  id: "n1",
  parentId: null,
  childIds: ["c1", "c2", "c3"],
  assetId: "a1",
  prompt: "海面",
  branchLabel: "海面",
  origin: "remembered",
  sceneRegions: [],
  createdAt: new Date().toISOString(),
};

const branches: DreamNode[] = [
  { ...parent, id: "c1", branchLabel: "分支1", assetId: "a1", parentId: "n1", createdAt: new Date().toISOString() },
  { ...parent, id: "c2", branchLabel: "分支2", assetId: "a2", parentId: "n1", createdAt: new Date().toISOString() },
  { ...parent, id: "c3", branchLabel: "分支3", assetId: "a3", parentId: "n1", createdAt: new Date().toISOString() },
];

describe("BranchPicker", () => {
  it("只有一个子分支时不显示", () => {
    render(
      <BranchPicker
        node={parent}
        branches={[branches[0]!]}
        activeChildId="c1"
        onSelect={() => {}}
        onClose={() => {}}
      />
    );
    expect(document.body.querySelector('[data-testid="branch-picker"]')).toBeNull();
  });

  it("渲染到 document.body（Portal）", () => {
    render(
      <BranchPicker
        node={parent}
        branches={branches}
        activeChildId="c1"
        onSelect={() => {}}
        onClose={() => {}}
      />
    );
    expect(document.body.querySelector('[data-testid="branch-picker"]')).not.toBeNull();
  });

  it("列出所有子分支", () => {
    render(
      <BranchPicker
        node={parent}
        branches={branches}
        activeChildId="c1"
        onSelect={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("分支1")).toBeInTheDocument();
    expect(screen.getByText("分支2")).toBeInTheDocument();
    expect(screen.getByText("分支3")).toBeInTheDocument();
  });

  it("点击分支触发 onSelect", () => {
    const onSelect = vi.fn();
    render(
      <BranchPicker
        node={parent}
        branches={branches}
        activeChildId="c1"
        onSelect={onSelect}
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByText("分支2"));
    expect(onSelect).toHaveBeenCalledWith("c2");
  });

  it("关闭按钮触发 onClose", () => {
    const onClose = vi.fn();
    render(
      <BranchPicker
        node={parent}
        branches={branches}
        activeChildId="c1"
        onSelect={() => {}}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByLabelText("关闭分支选择"));
    expect(onClose).toHaveBeenCalled();
  });

  it("Escape 关闭", () => {
    const onClose = vi.fn();
    render(
      <BranchPicker
        node={parent}
        branches={branches}
        activeChildId="c1"
        onSelect={() => {}}
        onClose={onClose}
      />
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("当前 active 分支显示高亮", () => {
    render(
      <BranchPicker
        node={parent}
        branches={branches}
        activeChildId="c2"
        onSelect={() => {}}
        onClose={() => {}}
      />
    );
    const btn = screen.getByText("分支2").closest("button");
    expect(btn).toHaveAttribute("aria-current", "true");
  });
});