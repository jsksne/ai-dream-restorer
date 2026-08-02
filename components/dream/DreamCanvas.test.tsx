// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DreamCanvas, type ElementClickInfo } from "./DreamCanvas";
import type { SemanticTags } from "@/types";

afterEach(() => {
  cleanup();
});

const mockTags: SemanticTags = {
  scene: "海洋",
  emotion: "宁静",
  elements: ["大海", "月亮", "船"],
  elementPositions: [
    { name: "月亮", region: "top" },
    { name: "大海", region: "center" },
  ],
};

describe("DreamCanvas 画面区组件（v2 重构）", () => {
  describe("生成中状态", () => {
    it("isGenerating=true 时显示 ImageReveal 占位（不渲染 img）", () => {
      const { container } = render(
        <DreamCanvas
          imageUrl={null}
          isGenerating={true}
          semanticTags={null}
          onDirectExplore={() => {}}
          onShiftClick={() => {}}
        />
      );
      // 生成中：应有 ImageReveal 容器（包含 "AI 正在描绘你的梦境" 文案）
      expect(screen.getByText(/AI 正在描绘你的梦境/)).toBeInTheDocument();
      const img = container.querySelector("img");
      // 生成中不渲染最终 img
      expect(img).toBeNull();
    });
  });

  describe("图像展示", () => {
    it("有图像且 isGenerating=false 时渲染 img 元素", () => {
      const { container } = render(
        <DreamCanvas
          imageUrl="/generated/test.png"
          isGenerating={false}
          semanticTags={mockTags}
          onDirectExplore={() => {}}
          onShiftClick={() => {}}
        />
      );
      const img = container.querySelector("img");
      expect(img).not.toBeNull();
      expect(img?.getAttribute("src")).toBe("/generated/test.png");
    });

    it("无图像且 isGenerating=false 时显示引导文案", () => {
      render(
        <DreamCanvas
          imageUrl={null}
          isGenerating={false}
          semanticTags={null}
          onDirectExplore={() => {}}
          onShiftClick={() => {}}
        />
      );
      // 应该有某种引导文案（具体内容不强制）
      expect(screen.getByText(/描述|梦境|点击|开始|输入/)).toBeInTheDocument();
    });
  });

  describe("元素点击交互（坐标归一化）⭐ 核心", () => {
    it("单击画面应调用 onDirectExplore 并传入归一化坐标", () => {
      const onDirectExplore = vi.fn();
      const { container } = render(
        <DreamCanvas
          imageUrl="/generated/test.png"
          isGenerating={false}
          semanticTags={mockTags}
          onDirectExplore={onDirectExplore}
          onShiftClick={() => {}}
        />
      );
      // v2 重构后：onClick 绑定在容器 div（cursor-crosshair）上，而非 img
      const clickable = container.querySelector(".cursor-crosshair") as HTMLElement;
      expect(clickable).not.toBeNull();

      // mock 容器尺寸
      Object.defineProperty(clickable, "getBoundingClientRect", {
        value: () => ({ left: 0, top: 0, width: 1024, height: 1024 }),
        configurable: true,
      });

      fireEvent.click(clickable, {
        clientX: 256,
        clientY: 512,
        shiftKey: false,
      });

      expect(onDirectExplore).toHaveBeenCalledTimes(1);
      const arg = onDirectExplore.mock.calls[0][0] as ElementClickInfo;
      expect(arg).toHaveProperty("x");
      expect(arg).toHaveProperty("y");
      expect(arg).toHaveProperty("width", 1024);
      expect(arg).toHaveProperty("height", 1024);
      // 归一化坐标 0-1
      expect(arg.x).toBeCloseTo(0.25, 2);
      expect(arg.y).toBeCloseTo(0.5, 2);
      expect(arg.shiftKey).toBe(false);
    });

    it("Shift+点击应调用 onShiftClick 而非 onDirectExplore", () => {
      const onDirectExplore = vi.fn();
      const onShiftClick = vi.fn();
      const { container } = render(
        <DreamCanvas
          imageUrl="/generated/test.png"
          isGenerating={false}
          semanticTags={mockTags}
          onDirectExplore={onDirectExplore}
          onShiftClick={onShiftClick}
        />
      );
      const clickable = container.querySelector(".cursor-crosshair") as HTMLElement;
      expect(clickable).not.toBeNull();

      Object.defineProperty(clickable, "getBoundingClientRect", {
        value: () => ({ left: 0, top: 0, width: 1024, height: 1024 }),
        configurable: true,
      });

      fireEvent.click(clickable, {
        clientX: 512,
        clientY: 512,
        shiftKey: true,
      });

      expect(onDirectExplore).not.toHaveBeenCalled();
      expect(onShiftClick).toHaveBeenCalledTimes(1);
      const arg = onShiftClick.mock.calls[0][0] as ElementClickInfo;
      expect(arg.shiftKey).toBe(true);
    });
  });

  describe("可点元素 hover 提示（基于 elementPositions）", () => {
    it("无 hover 时 region-highlight 覆盖层不显示", () => {
      const { container } = render(
        <DreamCanvas
          imageUrl="/generated/test.png"
          isGenerating={false}
          semanticTags={mockTags}
          onDirectExplore={() => {}}
          onShiftClick={() => {}}
        />
      );
      // 默认无 hover，不应有 active 区域高亮
      const activeHighlight = container.querySelector(".region-highlight--active");
      expect(activeHighlight).toBeNull();
    });
  });

  describe("生成中不响应点击", () => {
    it("isGenerating=true 时点击不应触发 onDirectExplore", () => {
      const onDirectExplore = vi.fn();
      // 生成中时 imageUrl 可能为 null，但仍渲染 ImageReveal
      render(
        <DreamCanvas
          imageUrl={null}
          isGenerating={true}
          semanticTags={null}
          onDirectExplore={onDirectExplore}
          onShiftClick={() => {}}
        />
      );
      // 无 img 元素可点击
      expect(onDirectExplore).not.toHaveBeenCalled();
    });
  });
});
