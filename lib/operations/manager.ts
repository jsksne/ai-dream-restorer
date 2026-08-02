// ===== 统一任务生命周期管理器（server-side）=====
// 目标：
// 1. 每个 operation 都有唯一 ID 和单调递增 sequence
// 2. 完成后立即移出活跃表，防止内存泄漏
// 3. 终态快照保留短期 TTL，方便迟到 SSE 客户端拿到最终结果
// 4. 提供 abort / cancel / retry 入口，与 Orchestrator 解耦

import { EventEmitter } from "events";
import {
  TERMINAL_STATUSES,
  type OperationEvent,
  type OperationKind,
  type OperationListener,
  type OperationSnapshot,
  type OperationStage,
  type OperationStatus,
} from "./types";

const TERMINAL_TTL_MS = 30_000;

interface ActiveOperation {
  id: string;
  sequence: number;
  kind: OperationKind;
  status: OperationStatus;
  stage: OperationStage;
  startedAt: number;
  updatedAt: number;
  eventCount: number;
  /** 该 operation 的 abort controller（用于取消上游请求） */
  abortController: AbortController;
  /** 该 operation 的 listeners */
  emitter: EventEmitter;
  /** 阶段事件序号（内部使用） */
  sequenceCounter: number;
}

export class OperationManager {
  private active = new Map<string, ActiveOperation>();
  private terminal = new Map<string, OperationSnapshot>();
  private listeners = new Map<string, Set<OperationListener>>();

  /**
   * 创建新 operation。返回初始快照。
   * 已存在同名 ID 的活跃 operation 会抛出错误；终态 ID 会被覆盖。
   */
  create(input: { operationId: string; kind: OperationKind; sequence: number }): OperationSnapshot {
    if (this.active.has(input.operationId)) {
      throw new Error(`Operation ${input.operationId} 已存在`);
    }
    const now = Date.now();
    const op: ActiveOperation = {
      id: input.operationId,
      sequence: input.sequence,
      kind: input.kind,
      status: "queued",
      stage: "understand-dream",
      startedAt: now,
      updatedAt: now,
      eventCount: 0,
      abortController: new AbortController(),
      emitter: new EventEmitter(),
      sequenceCounter: 0,
    };
    op.emitter.setMaxListeners(50);
    this.active.set(input.operationId, op);
    return this.snapshot(op);
  }

  /** 获取活跃 operation 的 abort signal */
  signalOf(operationId: string): AbortSignal | undefined {
    return this.active.get(operationId)?.abortController.signal;
  }

  /** 发射事件，附带递增 sequence。自动应用超时与取消监听 */
  emit(
    operationId: string,
    init: {
      status?: OperationStatus;
      stage?: OperationStage;
      message?: string;
      artifactId?: string;
      errorCode?: string;
      retryCount?: 0 | 1;
    }
  ): OperationEvent | null {
    const op = this.active.get(operationId);
    if (!op) return null;
    if (TERMINAL_STATUSES.includes(op.status)) return null;
    op.sequenceCounter++;
    op.status = init.status ?? op.status;
    op.stage = init.stage ?? op.stage;
    op.updatedAt = Date.now();
    op.eventCount++;
    const event: OperationEvent = {
      operationId: op.id,
      sequence: op.sequence,
      kind: op.kind,
      status: op.status,
      stage: op.stage,
      message: init.message ?? "",
      retryCount: init.retryCount ?? 0,
      artifactId: init.artifactId,
      errorCode: init.errorCode,
      timestamp: new Date(op.updatedAt).toISOString(),
    };
    op.emitter.emit("event", event);
    if (TERMINAL_STATUSES.includes(op.status)) {
      this.promoteToTerminal(op);
    }
    return event;
  }

  /** 标记完成；final artifactId 可选 */
  complete(operationId: string, artifactId?: string): void {
    this.emit(operationId, {
      status: "completed",
      stage: "complete",
      message: "已完成",
      artifactId,
    });
  }

  fail(operationId: string, errorCode: string, message?: string): void {
    this.emit(operationId, {
      status: "failed",
      message: message ?? errorCode,
      errorCode,
    });
  }

  cancel(operationId: string): void {
    const op = this.active.get(operationId);
    if (!op) return;
    if (TERMINAL_STATUSES.includes(op.status)) return;
    try {
      op.abortController.abort();
    } catch {
      // ignore
    }
    this.emit(operationId, {
      status: "cancelled",
      message: "已取消",
    });
  }

  /** 订阅 operation 事件；返回取消订阅函数 */
  subscribe(operationId: string, listener: OperationListener): () => void {
    const op = this.active.get(operationId);
    if (!op) {
      // 可能是终态：从 terminal 拿快照，立即推送一次终态事件
      const snap = this.terminal.get(operationId);
      if (snap) {
        listener({
          operationId,
          sequence: snap.sequence,
          kind: snap.kind,
          status: snap.status,
          stage: snap.stage,
          message: "已完成",
          retryCount: 0,
          timestamp: new Date(snap.updatedAt).toISOString(),
        });
      }
      return () => {};
    }
    op.emitter.on("event", listener);
    return () => op.emitter.off("event", listener);
  }

  /** 快照方法（内部 + 测试可访问） */
  publicSnapshot(operationId: string): OperationSnapshot | null {
    const active = this.active.get(operationId);
    if (active) return this.snapshot(active);
    return this.terminal.get(operationId) ?? null;
  }

  /** 当前活跃 operation 数（供测试） */
  activeCount(): number {
    return this.active.size;
  }

  /** 终态快照数 */
  terminalCount(): number {
    return this.terminal.size;
  }

  /** 主动清理过期终态快照 */
  sweepExpired(now = Date.now()): number {
    let removed = 0;
    for (const [id, snap] of this.terminal) {
      if (now - snap.updatedAt > TERMINAL_TTL_MS) {
        this.terminal.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /** 重置（仅测试用） */
  reset(): void {
    for (const op of this.active.values()) {
      try {
        op.abortController.abort();
      } catch {
        // ignore
      }
    }
    this.active.clear();
    this.terminal.clear();
    this.listeners.clear();
  }

  private promoteToTerminal(op: ActiveOperation): void {
    const snap = this.snapshot(op);
    this.active.delete(op.id);
    this.terminal.set(op.id, snap);
    // 终态后保留 emitter 一段时间，便于迟到订阅者拿到最终事件
    setTimeout(() => {
      op.emitter.removeAllListeners();
    }, TERMINAL_TTL_MS).unref?.();
  }

  private snapshot(op: ActiveOperation): OperationSnapshot {
    return {
      operationId: op.id,
      sequence: op.sequence,
      kind: op.kind,
      status: op.status,
      stage: op.stage,
      startedAt: op.startedAt,
      updatedAt: op.updatedAt,
      eventCount: op.eventCount,
    };
  }
}

/** 默认单例 manager */
let _default: OperationManager | null = null;
export function getOperationManager(): OperationManager {
  if (!_default) {
    _default = new OperationManager();
    if (typeof process !== "undefined" && typeof setInterval === "function") {
      const interval = setInterval(() => _default?.sweepExpired(), 10_000);
      interval.unref?.();
    }
  }
  return _default;
}

/** 测试用：重置单例 */
export function resetOperationManagerForTest(): void {
  if (_default) _default.reset();
  _default = null;
}