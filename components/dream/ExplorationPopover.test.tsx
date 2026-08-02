// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ExplorationPopover } from "./ExplorationPopover";

afterEach(cleanup);

describe("ExplorationPopover", () => {
  it("渲染到 document.body（Portal）", () => {
    render(
      <ExplorationPopover
        position={{ x: 200, y: 200 }}
        element="大海"
        identifying={false}
        onExplore={() => {}}
        onCancel={() => {}}
      />
    );
    const el = document.body.querySelector('[data-testid="exploration-popover"]');
    expect(el).not.toBeNull();
  });

  it("显示识别到的元素名", () => {
    render(
      <ExplorationPopover
        position={{ x: 100, y: 100 }}
        element="月亮"
        identifying={false}
        onExplore={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText("月亮")).toBeInTheDocument();
  });

  it("identifying 状态显示'正在看看这里'", () => {
    render(
      <ExplorationPopover
        position={{ x: 100, y: 100 }}
        element={null}
        identifying={true}
        onExplore={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText(/正在看看这里/)).toBeInTheDocument();
  });

  it("主按钮'往里看看！'触发 onExplore", () => {
    const onExplore = vi.fn();
    render(
      <ExplorationPopover
        position={{ x: 100, y: 100 }}
        element="月亮"
        identifying={false}
        onExplore={onExplore}
        onCancel={() => {}}
      />
    );
    fireEvent.click(screen.getByText("往里看看！"));
    expect(onExplore).toHaveBeenCalledWith("");
  });

  it("用户补充文字一并传给 onExplore", () => {
    const onExplore = vi.fn();
    render(
      <ExplorationPopover
        position={{ x: 100, y: 100 }}
        element="月亮"
        identifying={false}
        onExplore={onExplore}
        onCancel={() => {}}
      />
    );
    const input = screen.getByPlaceholderText(/补充/);
    fireEvent.change(input, { target: { value: "更冷一些" } });
    fireEvent.click(screen.getByText("往里看看！"));
    expect(onExplore).toHaveBeenCalledWith("更冷一些");
  });

  it("identifying 时主按钮禁用", () => {
    render(
      <ExplorationPopover
        position={{ x: 100, y: 100 }}
        element={null}
        identifying={true}
        onExplore={() => {}}
        onCancel={() => {}}
      />
    );
    const btn = screen.getByText("往里看看！") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("取消按钮触发 onCancel", () => {
    const onCancel = vi.fn();
    render(
      <ExplorationPopover
        position={{ x: 100, y: 100 }}
        element="月亮"
        identifying={false}
        onExplore={() => {}}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText("取消"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("Escape 键触发 onCancel", () => {
    const onCancel = vi.fn();
    render(
      <ExplorationPopover
        position={{ x: 100, y: 100 }}
        element="月亮"
        identifying={false}
        onExplore={() => {}}
        onCancel={onCancel}
      />
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});