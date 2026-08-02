// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StageProgress } from "./StageProgress";
import { GENERATE_STAGES, EXPLORE_STAGES, ANALYZE_STAGES } from "@/lib/operations/types";

afterEach(cleanup);

describe("StageProgress", () => {
  it("generate 阶段列表正确显示", () => {
    render(
      <StageProgress
        kind="generate"
        stage="compose-scene"
        status="running"
      />
    );
    expect(screen.getByText("理解梦境")).toBeInTheDocument();
    expect(screen.getByText("组织场景")).toBeInTheDocument();
    expect(screen.getByText("生成图像")).toBeInTheDocument();
    expect(screen.getByText("保存并识别")).toBeInTheDocument();
  });

  it("explore 阶段列表", () => {
    render(<StageProgress kind="explore" stage="plan-branch" status="running" />);
    expect(screen.getByText("锁定区域")).toBeInTheDocument();
    expect(screen.getByText("规划分支")).toBeInTheDocument();
    expect(screen.getByText("接入探索树")).toBeInTheDocument();
  });

  it("analyze 阶段列表", () => {
    render(<StageProgress kind="analyze" stage="analyze-clues" status="running" />);
    expect(screen.getByText("读取版本")).toBeInTheDocument();
    expect(screen.getByText("分析线索")).toBeInTheDocument();
    expect(screen.getByText("汇总联想")).toBeInTheDocument();
  });

  it("当前阶段显示动画", () => {
    render(<StageProgress kind="generate" stage="compose-scene" status="running" />);
    const current = screen.getByText("组织场景").closest("li");
    expect(current).toHaveAttribute("aria-current", "step");
  });

  it("已完成阶段显示对勾", () => {
    render(<StageProgress kind="generate" stage="persist-and-map" status="running" />);
    expect(screen.getAllByText("✓").length).toBe(3);
  });

  it("completed 状态显示完成文案", () => {
    render(<StageProgress kind="generate" stage="complete" status="completed" />);
    expect(screen.getByText("完成")).toBeInTheDocument();
  });

  it("cancelled 状态显示已取消", () => {
    render(<StageProgress kind="generate" stage="understand-dream" status="cancelled" />);
    expect(screen.getByText("已取消")).toBeInTheDocument();
  });

  it("running 状态下显示取消按钮", () => {
    let called = false;
    render(
      <StageProgress
        kind="generate"
        stage="compose-scene"
        status="running"
        onCancel={() => (called = true)}
      />
    );
    const btn = screen.getByText("取消");
    btn.click();
    expect(called).toBe(true);
  });

  it("completed 状态下不显示取消按钮", () => {
    render(
      <StageProgress
        kind="generate"
        stage="complete"
        status="completed"
        onCancel={() => {}}
      />
    );
    expect(screen.queryByText("取消")).toBeNull();
  });

  it("GENERATE_STAGES / EXPLORE_STAGES / ANALYZE_STAGES 各自固定", () => {
    expect(GENERATE_STAGES.length).toBeGreaterThan(0);
    expect(EXPLORE_STAGES.length).toBeGreaterThan(0);
    expect(ANALYZE_STAGES.length).toBeGreaterThan(0);
  });
});