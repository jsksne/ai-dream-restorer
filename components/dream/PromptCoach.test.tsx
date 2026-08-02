// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PromptCoach } from "./PromptCoach";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PromptCoach", () => {
  it("渲染对话框并在请求期间显示加载状态", () => {
    render(
      <PromptCoach
        initialDescription="海面"
        round={0}
        onReady={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("正在根据你的描述组织下一个问题");
  });

  it("使用服务端实时问题而不是预设问题", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ready: false,
        question: "月亮靠近你时，你最先注意到什么？",
        targetSlot: "sensory",
        options: [
          { id: "light", label: "月光", value: "冰凉的月光" },
          { id: "sound", label: "声音", value: "潮水声" },
        ],
        allowFreeText: true,
        summary: "海面与月亮",
        recommendedStyle: "电影感画面",
        missingHighImpactSlots: ["sensory"],
        round: 0,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PromptCoach
        initialDescription="我梦见月亮贴着海面"
        round={0}
        onReady={() => {}}
        onCancel={() => {}}
      />
    );

    expect(await screen.findByText("月亮靠近你时，你最先注意到什么？")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent-ask",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("风格始终可见且可切换", () => {
    render(
      <PromptCoach
        initialDescription="海面"
        round={0}
        onReady={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText("电影感")).toBeInTheDocument();
    expect(screen.getByText("水彩")).toBeInTheDocument();
  });

  it("记不清，交给 AI 触发 onReady", () => {
    const onReady = vi.fn();
    render(
      <PromptCoach
        initialDescription="海面"
        round={0}
        onReady={onReady}
        onCancel={() => {}}
      />
    );
    fireEvent.click(screen.getByText("记不清，交给 AI"));
    expect(onReady).toHaveBeenCalled();
  });

  it("现在就生成携带自由补充内容", () => {
    const onReady = vi.fn();
    render(
      <PromptCoach
        initialDescription="海面"
        round={0}
        onReady={onReady}
        onCancel={() => {}}
      />
    );
    fireEvent.click(screen.getByText("现在就生成"));
    expect(onReady).toHaveBeenCalled();
  });
});
