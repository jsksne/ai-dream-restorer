// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOperation } from "./useOperation";
import type { OperationEvent } from "@/lib/operations/types";

function makeEvent(seq: number, opId: string, status: OperationEvent["status"], stage: OperationEvent["stage"]): OperationEvent {
  return {
    operationId: opId,
    sequence: seq,
    kind: "generate",
    status,
    stage,
    message: "",
    retryCount: 0,
    timestamp: new Date().toISOString(),
  };
}

describe("useOperation", () => {
  it("初始状态为 idle", () => {
    const { result } = renderHook(() => useOperation());
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.operationId).toBeNull();
  });

  it("start 返回 operationId 与 signal，并把 status 设为 queued", () => {
    const { result } = renderHook(() => useOperation());
    let out: ReturnType<typeof result.current.start> | null = null;
    act(() => {
      out = result.current.start({ kind: "generate" });
    });
    expect(out).not.toBeNull();
    expect(out!.operationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(out!.sequence).toBe(1);
    expect(result.current.state.status).toBe("queued");
  });

  it("第二次 start 自增 sequence 并取消旧 controller", () => {
    const { result } = renderHook(() => useOperation());
    let firstSignal!: AbortSignal;
    act(() => {
      firstSignal = result.current.start({ kind: "generate" }).signal as AbortSignal;
    });
    expect(firstSignal.aborted).toBe(false);
    let second: ReturnType<typeof result.current.start> | null = null;
    act(() => {
      second = result.current.start({ kind: "explore" });
    });
    expect(second!.sequence).toBe(2);
    expect(firstSignal.aborted).toBe(true);
  });

  it("applyEvent 只接受匹配 (operationId, sequence) 的事件", () => {
    const { result } = renderHook(() => useOperation());
    let out: ReturnType<typeof result.current.start> | null = null;
    act(() => {
      out = result.current.start({ kind: "generate" });
    });
    const opId = out!.operationId;
    const seq = out!.sequence;

    act(() => {
      result.current.applyEvent(
        makeEvent(seq, opId, "running", "compose-scene")
      );
    });
    expect(result.current.state.stage).toBe("compose-scene");

    // sequence 不匹配 → 丢弃
    act(() => {
      result.current.applyEvent(
        makeEvent(seq + 99, opId, "completed", "complete")
      );
    });
    expect(result.current.state.status).toBe("running");

    // operationId 不匹配 → 丢弃
    act(() => {
      result.current.applyEvent(
        makeEvent(seq, "wrong-id", "completed", "complete")
      );
    });
    expect(result.current.state.status).toBe("running");
  });

  it("终态后迟到事件被丢弃", () => {
    const { result } = renderHook(() => useOperation());
    let out: ReturnType<typeof result.current.start> | null = null;
    act(() => {
      out = result.current.start({ kind: "generate" });
    });
    const { operationId, sequence } = out!;
    act(() => {
      result.current.applyEvent(
        makeEvent(sequence, operationId, "completed", "complete")
      );
    });
    expect(result.current.state.status).toBe("completed");

    act(() => {
      result.current.applyEvent(
        makeEvent(sequence, operationId, "failed", "understand-dream")
      );
    });
    expect(result.current.state.status).toBe("completed");
  });

  it("cancel 标记 cancelled 并 abort 当前 controller", () => {
    const { result } = renderHook(() => useOperation());
    let signal!: AbortSignal;
    act(() => {
      signal = result.current.start({ kind: "generate" }).signal as AbortSignal;
    });
    expect(signal.aborted).toBe(false);
    act(() => {
      result.current.cancel();
    });
    expect(signal.aborted).toBe(true);
    expect(result.current.state.status).toBe("cancelled");
  });

  it("cancel 不会让 cancelled 状态被运行事件覆盖", () => {
    const { result } = renderHook(() => useOperation());
    let out: ReturnType<typeof result.current.start> | null = null;
    act(() => {
      out = result.current.start({ kind: "generate" });
    });
    const { operationId, sequence } = out!;
    act(() => {
      result.current.cancel();
    });
    act(() => {
      // 模拟 cancel 后还有迟到 running 事件
      result.current.applyEvent(
        makeEvent(sequence, operationId, "running", "generate-image")
      );
    });
    expect(result.current.state.status).toBe("cancelled");
  });

  it("reset 后所有状态归零", () => {
    const { result } = renderHook(() => useOperation());
    act(() => {
      result.current.start({ kind: "generate" });
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.operationId).toBeNull();
  });
});