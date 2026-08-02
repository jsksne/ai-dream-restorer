"use client";

// 客户端单任务管理 hook（one operation per session）
// 核心规则：
// 1. 每次启动新操作前必须取消旧 controller
// 2. operationId 必须全局唯一
// 3. sequence 必须单调递增
// 4. 只有匹配 (operationId, sequence) 的事件可以写入 store；旧操作迟到事件被丢弃

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TERMINAL_STATUSES,
  type OperationEvent,
  type OperationKind,
  type OperationSnapshot,
  type OperationStage,
} from "@/lib/operations/types";

export interface UseOperationState {
  operationId: string | null;
  sequence: number;
  kind: OperationKind | null;
  stage: OperationStage | null;
  status: "idle" | "queued" | "running" | "completed" | "failed" | "cancelled";
  error?: string;
  artifactId?: string;
}

export interface UseOperationApi {
  state: UseOperationState;
  /** 启动新操作；返回 operationId 与 signal */
  start: (input: { kind: OperationKind }) => {
    operationId: string;
    sequence: number;
    signal: AbortSignal;
  };
  /** 应用远端或本地事件 */
  applyEvent: (event: OperationEvent) => void;
  /** 应用完整快照 */
  applySnapshot: (snapshot: OperationSnapshot) => void;
  /** 主动取消当前操作 */
  cancel: () => void;
  /** 重置为 idle（保留 abort controller 引用由 GC 释放） */
  reset: () => void;
}

function generateOperationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const INITIAL_STATE: UseOperationState = {
  operationId: null,
  sequence: 0,
  kind: null,
  stage: null,
  status: "idle",
};

export function useOperation(): UseOperationApi {
  const [state, setState] = useState<UseOperationState>(INITIAL_STATE);
  const controllerRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);
  const currentIdRef = useRef<string | null>(null);

  const cancel = useCallback(() => {
    if (controllerRef.current) {
      try {
        controllerRef.current.abort();
      } catch {
        // ignore
      }
      controllerRef.current = null;
    }
    const id = currentIdRef.current;
    if (id) {
      setState((s) =>
        s.operationId === id && !TERMINAL_STATUSES.includes(s.status as never)
          ? { ...s, status: "cancelled" }
          : s
      );
    }
  }, []);

  const reset = useCallback(() => {
    cancel();
    currentIdRef.current = null;
    sequenceRef.current = 0;
    setState(INITIAL_STATE);
  }, [cancel]);

  const start = useCallback(
    ({ kind }: { kind: OperationKind }) => {
      // 1. 取消旧 controller
      if (controllerRef.current) {
        try {
          controllerRef.current.abort();
        } catch {
          // ignore
        }
      }
      // 2. sequence 自增
      sequenceRef.current += 1;
      const sequence = sequenceRef.current;
      const operationId = generateOperationId();
      currentIdRef.current = operationId;
      const controller = new AbortController();
      controllerRef.current = controller;
      setState({
        operationId,
        sequence,
        kind,
        stage: null,
        status: "queued",
      });
      return { operationId, sequence, signal: controller.signal };
    },
    []
  );

  const applyEvent = useCallback((event: OperationEvent) => {
    // 序列不匹配或 operationId 不匹配的事件一律丢弃
    if (event.sequence !== sequenceRef.current) return;
    if (event.operationId !== currentIdRef.current) return;
    setState((prev) => {
      // 终态后忽略后续事件
      if (TERMINAL_STATUSES.includes(prev.status as never)) return prev;
      return {
        ...prev,
        status: event.status,
        stage: event.stage,
        error: event.errorCode ?? prev.error,
        artifactId: event.artifactId ?? prev.artifactId,
      };
    });
  }, []);

  const applySnapshot = useCallback((snapshot: OperationSnapshot) => {
    if (snapshot.operationId !== currentIdRef.current) return;
    if (snapshot.sequence !== sequenceRef.current) return;
    setState((prev) => ({
      ...prev,
      operationId: snapshot.operationId,
      sequence: snapshot.sequence,
      kind: snapshot.kind,
      stage: snapshot.stage,
      status: snapshot.status,
    }));
  }, []);

  // 卸载时清理
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        try {
          controllerRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    state,
    start,
    applyEvent,
    applySnapshot,
    cancel,
    reset,
  };
}