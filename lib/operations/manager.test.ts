import { describe, it, expect, beforeEach } from "vitest";
import {
  getOperationManager,
  resetOperationManagerForTest,
  OperationManager,
} from "./manager";
import { TERMINAL_STATUSES } from "./types";

describe("OperationManager", () => {
  let mgr: OperationManager;
  beforeEach(() => {
    resetOperationManagerForTest();
    mgr = getOperationManager();
  });

  it("create 返回初始快照并加入活跃表", () => {
    const snap = mgr.create({ operationId: "op-1", kind: "generate", sequence: 1 });
    expect(snap.status).toBe("queued");
    expect(snap.sequence).toBe(1);
    expect(mgr.activeCount()).toBe(1);
  });

  it("重复创建同名 operation 抛出", () => {
    mgr.create({ operationId: "op-2", kind: "generate", sequence: 1 });
    expect(() =>
      mgr.create({ operationId: "op-2", kind: "generate", sequence: 2 })
    ).toThrow();
  });

  it("emit 推进 status 与 stage 并通知监听者", () => {
    mgr.create({ operationId: "op-3", kind: "generate", sequence: 1 });
    const events: string[] = [];
    mgr.subscribe("op-3", (e) => events.push(`${e.stage}:${e.status}`));
    mgr.emit("op-3", { stage: "compose-scene", message: "组织场景" });
    mgr.emit("op-3", { stage: "generate-image", message: "生成图像" });
    expect(events).toEqual([
      "compose-scene:queued",
      "generate-image:queued",
    ]);
  });

  it("complete 移出活跃表并保留终态快照", () => {
    mgr.create({ operationId: "op-4", kind: "generate", sequence: 1 });
    mgr.complete("op-4", "asset-1");
    expect(mgr.activeCount()).toBe(0);
    expect(mgr.terminalCount()).toBe(1);
  });

  it("fail 同样进入终态", () => {
    mgr.create({ operationId: "op-5", kind: "explore", sequence: 1 });
    mgr.fail("op-5", "timeout", "请求超时");
    expect(mgr.activeCount()).toBe(0);
  });

  it("cancel 中止 abort signal 并标记 cancelled", () => {
    mgr.create({ operationId: "op-6", kind: "generate", sequence: 1 });
    const signal = mgr.signalOf("op-6");
    expect(signal?.aborted).toBe(false);
    mgr.cancel("op-6");
    expect(signal?.aborted).toBe(true);
    expect(mgr.activeCount()).toBe(0);
  });

  it("终态后迟到事件被忽略", () => {
    mgr.create({ operationId: "op-7", kind: "generate", sequence: 1 });
    mgr.complete("op-7");
    const event = mgr.emit("op-7", { stage: "complete", message: "再发一次" });
    expect(event).toBeNull();
    expect(mgr.terminalCount()).toBe(1);
  });

  it("终态 TTL 过期被 sweepExpired 清理", () => {
    mgr.create({ operationId: "op-8", kind: "generate", sequence: 1 });
    mgr.complete("op-8");
    expect(mgr.terminalCount()).toBe(1);
    const removed = mgr.sweepExpired(Date.now() + 31_000);
    expect(removed).toBe(1);
    expect(mgr.terminalCount()).toBe(0);
  });

  it("subscribe 收到 emit 事件", () => {
    mgr.create({ operationId: "op-9", kind: "generate", sequence: 1 });
    const events: string[] = [];
    const unsub = mgr.subscribe("op-9", (e) => events.push(e.stage));
    mgr.emit("op-9", { stage: "compose-scene" });
    mgr.emit("op-9", { stage: "generate-image" });
    unsub();
    mgr.emit("op-9", { stage: "complete" });
    expect(events).toEqual(["compose-scene", "generate-image"]);
  });

  it("终态后 subscribe 立即收到一次终态事件", () => {
    mgr.create({ operationId: "op-10", kind: "analyze", sequence: 1 });
    mgr.complete("op-10");
    const events: string[] = [];
    mgr.subscribe("op-10", (e) => events.push(`${e.status}:${e.stage}`));
    expect(events).toEqual(["completed:complete"]);
  });

  it("重置可清空所有状态", () => {
    mgr.create({ operationId: "op-11", kind: "generate", sequence: 1 });
    mgr.create({ operationId: "op-12", kind: "generate", sequence: 1 });
    mgr.reset();
    expect(mgr.activeCount()).toBe(0);
    expect(mgr.terminalCount()).toBe(0);
  });

  it("20 次操作后 activeCount 归零", () => {
    for (let i = 0; i < 20; i++) {
      mgr.create({ operationId: `op-bulk-${i}`, kind: "generate", sequence: i + 1 });
    }
    expect(mgr.activeCount()).toBe(20);
    for (let i = 0; i < 20; i++) {
      mgr.complete(`op-bulk-${i}`);
    }
    expect(mgr.activeCount()).toBe(0);
  });

  it("TERMINAL_STATUSES 包含 completed/failed/cancelled", () => {
    expect(TERMINAL_STATUSES).toEqual(["completed", "failed", "cancelled"]);
  });

  it("cancel 不会重复进入终态", () => {
    mgr.create({ operationId: "op-13", kind: "generate", sequence: 1 });
    mgr.cancel("op-13");
    mgr.cancel("op-13"); // 二次调用安全
    expect(mgr.activeCount()).toBe(0);
  });

  it("每次 emit 事件 sequence 字段稳定（来自 manager 输入）", () => {
    mgr.create({ operationId: "op-14", kind: "generate", sequence: 7 });
    let lastSeq = 0;
    mgr.subscribe("op-14", (e) => (lastSeq = e.sequence));
    mgr.emit("op-14", { stage: "compose-scene" });
    expect(lastSeq).toBe(7);
  });

  it("fake timers + sweep 测试", async () => {
    mgr.create({ operationId: "op-15", kind: "generate", sequence: 1 });
    mgr.complete("op-15");
    expect(mgr.terminalCount()).toBe(1);
    const removed = mgr.sweepExpired(Date.now() + 31_000);
    expect(removed).toBe(1);
    expect(mgr.terminalCount()).toBe(0);
  });
});