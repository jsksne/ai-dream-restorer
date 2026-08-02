// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { dispatchAction, UnifiedInput } from "./UnifiedInput";

afterEach(() => {
  cleanup();
});

describe("UnifiedInput 统一输入框组件", () => {
  it("渲染底部常驻输入框与发送按钮", () => {
    render(
      <UnifiedInput
        value=""
        selectedElement={null}
        isGenerating={false}
        onChange={() => {}}
        onSubmit={() => {}}
        onClearElement={() => {}}
      />
    );
    expect(screen.getByRole("textbox", { name: /梦境描述|输入/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /发送|生成/ })).toBeInTheDocument();
  });

  it("输入文本时触发 onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <UnifiedInput
        value=""
        selectedElement={null}
        isGenerating={false}
        onChange={onChange}
        onSubmit={() => {}}
        onClearElement={() => {}}
      />
    );
    const input = screen.getByRole("textbox", { name: /梦境描述|输入/ });
    await user.type(input, "大海");
    expect(onChange).toHaveBeenCalled();
  });

  it("回车键触发 onSubmit（当有文本时）", () => {
    const onSubmit = vi.fn();
    render(
      <UnifiedInput
        value="更平静的海"
        selectedElement={null}
        isGenerating={false}
        onChange={() => {}}
        onSubmit={onSubmit}
        onClearElement={() => {}}
      />
    );
    const input = screen.getByRole("textbox", { name: /梦境描述|输入/ });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("空文本时回车不触发 onSubmit", () => {
    const onSubmit = vi.fn();
    render(
      <UnifiedInput
        value="   "
        selectedElement={null}
        isGenerating={false}
        onChange={() => {}}
        onSubmit={onSubmit}
        onClearElement={() => {}}
      />
    );
    const input = screen.getByRole("textbox", { name: /梦境描述|输入/ });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("点击发送按钮触发 onSubmit", () => {
    const onSubmit = vi.fn();
    render(
      <UnifiedInput
        value="更平静的海"
        selectedElement={null}
        isGenerating={false}
        onChange={() => {}}
        onSubmit={onSubmit}
        onClearElement={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /发送|生成/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("已选元素时显示上下文提示（→ 探索：xxx）与清除按钮", () => {
    render(
      <UnifiedInput
        value=""
        selectedElement="大海"
        isGenerating={false}
        onChange={() => {}}
        onSubmit={() => {}}
        onClearElement={() => {}}
      />
    );
    expect(screen.getByText(/探索/)).toBeInTheDocument();
    expect(screen.getByText("大海")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /清除|取消|✕/ })).toBeInTheDocument();
  });

  it("点击清除元素按钮触发 onClearElement", () => {
    const onClearElement = vi.fn();
    render(
      <UnifiedInput
        value=""
        selectedElement="大海"
        isGenerating={false}
        onChange={() => {}}
        onSubmit={() => {}}
        onClearElement={onClearElement}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /清除|取消|✕/ }));
    expect(onClearElement).toHaveBeenCalledTimes(1);
  });

  it("生成中时输入框保持可用，但发送按钮 disabled（按 v2 规范：按钮 disabled，仍允许输入排队）", () => {
    render(
      <UnifiedInput
        value=""
        selectedElement={null}
        isGenerating={true}
        onChange={() => {}}
        onSubmit={() => {}}
        onClearElement={() => {}}
      />
    );
    const input = screen.getByRole("textbox", { name: /梦境描述|输入/ });
    const btn = screen.getByRole("button", { name: /发送|生成/ });
    // 输入框始终可用，允许用户继续打字排队下一次提交
    expect(input).not.toBeDisabled();
    // 发送按钮在生成中应 disabled，防止重复触发
    expect(btn).toBeDisabled();
  });

  it("生成中时发送按钮文案变为「生成中...」", () => {
    render(
      <UnifiedInput
        value=""
        selectedElement={null}
        isGenerating={true}
        onChange={() => {}}
        onSubmit={() => {}}
        onClearElement={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: /生成中|生成中\.\.\./ })).toBeInTheDocument();
  });

  it("占位文案随是否选中元素变化（选中元素时提示引导式探索）", () => {
    const { rerender } = render(
      <UnifiedInput
        value=""
        selectedElement={null}
        isGenerating={false}
        onChange={() => {}}
        onSubmit={() => {}}
        onClearElement={() => {}}
      />
    );
    const inputNoEl = screen.getByRole("textbox", { name: /梦境描述|输入/ });
    expect(inputNoEl.getAttribute("placeholder")).toMatch(/微调|描述/);

    rerender(
      <UnifiedInput
        value=""
        selectedElement="大海"
        isGenerating={false}
        onChange={() => {}}
        onSubmit={() => {}}
        onClearElement={() => {}}
      />
    );
    const inputWithEl = screen.getByRole("textbox", { name: /梦境描述|输入/ });
    expect(inputWithEl.getAttribute("placeholder")).toMatch(/探索|引导/);
  });
});

describe("dispatchAction 行为分发逻辑", () => {
  it("dispatches initial when text is submitted without an active dream", () => {
    expect(dispatchAction("initial dream", null, false)).toEqual({
      action: "initial",
      element: null,
    });
  });

  // 通过 onSubmit 回调的第二个参数 action 验证分发逻辑
  it("仅打字（无元素）→ action='refine'", () => {
    const onSubmit = vi.fn();
    render(
      <UnifiedInput
        value="更平静的海"
        selectedElement={null}
        hasActiveNode={true}
        isGenerating={false}
        onChange={() => {}}
        onSubmit={onSubmit}
        onClearElement={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /发送|生成/ }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: "refine" })
    );
  });

  it("点元素+打字 → action='guided-explore'", () => {
    const onSubmit = vi.fn();
    render(
      <UnifiedInput
        value="游向深处"
        selectedElement="大海"
        isGenerating={false}
        onChange={() => {}}
        onSubmit={onSubmit}
        onClearElement={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /发送|生成/ }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: "guided-explore" })
    );
  });

  it("仅点元素（无文本）→ action='auto-explore'", () => {
    const onSubmit = vi.fn();
    render(
      <UnifiedInput
        value=""
        selectedElement="大海"
        isGenerating={false}
        onChange={() => {}}
        onSubmit={onSubmit}
        onClearElement={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /发送|生成/ }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: "auto-explore" })
    );
  });
});
