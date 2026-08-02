"use client";

// ===== 统一 Operation 事件 SSE 订阅 Zustand store =====
import { create } from 'zustand';
import type { OperationEvent, OperationStage } from '@/lib/operations/types';

interface AgentStreamState {
  /** 当前 Operation 阶段 */
  stage: OperationStage | null;
  /** 当前 status */
  status: 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** 错误信息 */
  error?: string;
  /** 累积的 delta（按 dimension key） */
  deltaBuffer: Record<string, string>;
  /** Operation 是否存在 */
  operationExists: boolean;
  /** 取消订阅函数 */
  unsubscribe?: () => void;
  /** 订阅 operationId+sequence */
  subscribe: (operationId: string, sequence: number) => () => void;
  /** 重置 */
  reset: () => void;
  /** 推 delta（demo 模式） */
  pushDelta: (key: string, delta: string) => void;
}

const initialState = {
  stage: null as OperationStage | null,
  status: 'idle' as AgentStreamState['status'],
  error: undefined as string | undefined,
  deltaBuffer: {} as Record<string, string>,
  operationExists: true,
  unsubscribe: undefined as (() => void) | undefined,
};

export const useAgentStream = create<AgentStreamState>((set, get) => ({
  ...initialState,
  subscribe: (operationId, sequence) => {
    const prevUnsub = get().unsubscribe;
    if (prevUnsub) prevUnsub();

    set({ ...initialState, operationExists: true });

    const url = `/api/stream?operationId=${encodeURIComponent(
      operationId
    )}&sequence=${sequence}`;
    const es = new EventSource(url);

    es.onmessage = (ev) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      const type = data.type as string;
      switch (type) {
        case 'operation:snapshot': {
          const snapshot = data.snapshot as { status: AgentStreamState['status']; stage: OperationStage };
          set({ status: snapshot.status, stage: snapshot.stage, operationExists: true });
          break;
        }
        case 'operation:not_found': {
          set({ operationExists: false, status: 'failed', error: 'Operation 不存在' });
          break;
        }
        case 'operation:event': {
          const event = data.event as OperationEvent;
          set({ status: event.status, stage: event.stage, error: event.errorCode });
          if (event.artifactId && event.status === 'completed') {
            // 可选：把 artifactId 暴露给 UI（demo 时由前端另行处理）
          }
          break;
        }
        case 'ping':
          break;
      }
    };

    es.onerror = () => {
      const current = get().status;
      if (current === 'completed' || current === 'failed' || current === 'cancelled') {
        es.close();
      }
    };

    const unsubscribe = () => es.close();
    set({ unsubscribe });
    return unsubscribe;
  },
  reset: () => {
    const unsub = get().unsubscribe;
    if (unsub) unsub();
    set({ ...initialState, operationExists: true });
  },
  pushDelta: (key, delta) =>
    set((s) => ({
      deltaBuffer: { ...s.deltaBuffer, [key]: (s.deltaBuffer[key] || '') + delta },
    })),
}));