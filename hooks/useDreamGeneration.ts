"use client";

// ===== Oneira 梦境生成流程 Hook（v2 重构版）=====
// 接入 OperationManager 序列：每次操作有唯一 operationId + sequence
// 使用 fetchWithRetry 实现超时与重试
// 取消传播到上游请求；旧操作的事件不会写入当前会话

import { useState, useCallback } from "react";
import type { GenerationStatus } from "@/types";
import { useSession } from "./useSession";
import { useOperation } from "./useOperation";
import { fetchWithRetry } from "@/lib/fetch-with-retry";

const TIMEOUT_TEXT = 45_000;
const TIMEOUT_IMAGE = 120_000;

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface GenerateResponse {
  taskId: string;
  needAsk: boolean;
  question?: string;
  optimizedDescription?: string;
  imageUrl?: string;
  assetId?: string;
  tags?: { scene: string; emotion: string; elements: string[] };
}

interface ExploreResponse {
  taskId: string;
  element: string;
  imageUrl: string;
  assetId: string;
  tags: { scene: string; emotion: string; elements: string[] };
}

interface AgentAskResponse {
  taskId: string;
  optimizedDescription: string;
  imageUrl: string;
  assetId: string;
  tags: { scene: string; emotion: string; elements: string[] };
}

interface AnalyzeResponse {
  taskId: string;
  exploreNote: string | null;
  disclaimer: string;
  mode: "multimodal" | "text-only";
  visualEvidence: Array<{ observation: string; confidence: number }>;
  dreamClues: string;
  emotionalThread: string;
  possibleConnections: string;
  reflectionQuestions: string[];
  explorationTrace: Array<{ nodeId: string; summary: string; confidence: "low" }>;
}

/**
 * 梦境生成流程 Hook
 */
export function useDreamGeneration() {
  const session = useSession();
  const op = useOperation();

  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  /** 启动一个新 operation */
  const startOperation = useCallback(
    (kind: 'generate' | 'explore' | 'refine' | 'analyze' | 'identify') => {
      const out = op.start({ kind });
      setCurrentTaskId(out.operationId);
      return out;
    },
    [op]
  );

  const failTask = useCallback((errMsg: string) => {
    setError(errMsg);
    setStatus('error');
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    if (status === 'error') setStatus('idle');
  }, [status]);

  const getCurrentImageUrl = useCallback((): string | null => {
    const active = session.getActive();
    if (active) return `/api/assets/${active.assetId}`;
    return null;
  }, [session]);

  /**
   * 首次梦境生成
   */
  const generateInitial = useCallback(
    async (prompt: string, skipAsk = false): Promise<{ needAsk?: boolean; question?: string } | void> => {
      setError(null);
      setStatus('generating');

      const truncated = prompt.length > 500 ? prompt.slice(0, 500) : prompt;
      const { operationId, signal } = startOperation('generate');

      const result = await fetchWithRetry<GenerateResponse>(
        '/api/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: operationId, prompt: truncated, skipAsk }),
          signal,
        },
        { timeoutMs: TIMEOUT_IMAGE, maxRetries: 2, retryBaseMs: 800 }
      );

      if (!result.ok) {
        failTask(result.error ?? '生成失败');
        return;
      }

      const data = result.data!;
      if (data.needAsk && data.question) {
        setStatus('asking');
        return { needAsk: true, question: data.question };
      }

      if (data.imageUrl && data.assetId && data.tags) {
        await session.initNew(prompt, 'first-person');
        session.addNode({
          assetId: data.assetId,
          prompt: data.optimizedDescription ?? truncated,
          branchLabel: data.tags.scene || '初始画面',
          origin: 'remembered',
          sceneRegions: [],
        });
        setStatus('done');
      } else {
        failTask('生成响应缺少图像数据');
        return;
      }
    },
    [session, startOperation, failTask]
  );

  /**
   * 用户回答追问后继续生成
   */
  const answerAgentAsk = useCallback(
    async (originalDescription: string, answer: string): Promise<void> => {
      setError(null);
      setStatus('generating');

      const truncatedAnswer = answer.length > 300 ? answer.slice(0, 300) : answer;
      const { operationId, signal } = startOperation('generate');

      const result = await fetchWithRetry<AgentAskResponse>(
        '/api/agent-ask',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: operationId,
            originalDescription,
            answer: truncatedAnswer,
          }),
          signal,
        },
        { timeoutMs: TIMEOUT_IMAGE, maxRetries: 2, retryBaseMs: 800 }
      );

      if (!result.ok) {
        failTask(result.error ?? '生成失败');
        return;
      }

      const data = result.data!;
      if (data.imageUrl && data.assetId && data.tags) {
        session.addNode({
          assetId: data.assetId,
          prompt: data.optimizedDescription,
          branchLabel: data.tags.scene || '补充后画面',
          origin: 'remembered',
          sceneRegions: [],
        });
        setStatus('done');
      } else {
        failTask('生成响应缺少图像数据');
      }
    },
    [session, startOperation, failTask]
  );

  /**
   * 微调当前画面
   */
  const refine = useCallback(
    async (prompt: string): Promise<void> => {
      setError(null);
      const active = session.getActive();
      if (!active) {
        failTask('没有当前画面可微调');
        return;
      }
      setStatus('generating');

      const truncated = prompt.length > 500 ? prompt.slice(0, 500) : prompt;
      const { operationId, signal } = startOperation('refine');

      const result = await fetchWithRetry<ExploreResponse>(
        '/api/refine',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: operationId,
            prompt: truncated,
            assetId: active.assetId,
          }),
          signal,
        },
        { timeoutMs: TIMEOUT_IMAGE, maxRetries: 2, retryBaseMs: 800 }
      );

      if (!result.ok) {
        failTask(result.error ?? '微调失败');
        return;
      }

      const data = result.data!;
      if (data.assetId) {
        session.addNode({
          assetId: data.assetId,
          prompt: truncated,
          branchLabel: data.tags?.scene || '微调',
          origin: 'ai-exploration',
          sceneRegions: [],
        });
        setStatus('done');
      } else {
        failTask('微调响应缺少图像数据');
      }
    },
    [session, startOperation, failTask]
  );

  /**
   * 探索：基于归一化点击坐标 + 可选用户提示
   */
  const explore = useCallback(
    async (
      element: string,
      userPrompt?: string,
      clickInfo?: { x: number; y: number }
    ): Promise<void> => {
      setError(null);
      const active = session.getActive();
      if (!active) {
        failTask('没有当前画面可探索');
        return;
      }
      setStatus('generating');

      const { operationId, signal } = startOperation('explore');

      const result = await fetchWithRetry<ExploreResponse>(
        '/api/explore',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: operationId,
            assetId: active.assetId,
            clickX: clickInfo?.x ?? 0.5,
            clickY: clickInfo?.y ?? 0.5,
            userHint: userPrompt?.trim() || undefined,
          }),
          signal,
        },
        { timeoutMs: TIMEOUT_IMAGE, maxRetries: 2, retryBaseMs: 800 }
      );

      if (!result.ok) {
        failTask(result.error ?? '探索失败');
        return;
      }

      const data = result.data!;
      if (data.assetId) {
        const finalElement = data.element || element;
        session.addNode({
          assetId: data.assetId,
          prompt: userPrompt?.trim()
            ? `${userPrompt.trim()}（聚焦：${finalElement}）`
            : `深入探索画面中的${finalElement}`,
          branchLabel: finalElement,
          origin: 'ai-exploration',
          sourceRegion: clickInfo
            ? { x: clickInfo.x - 0.05, y: clickInfo.y - 0.05, width: 0.1, height: 0.1 }
            : undefined,
          sceneRegions: [],
        });
        setStatus('done');
      } else {
        failTask('探索响应缺少图像数据');
      }
    },
    [session, startOperation, failTask]
  );

  /**
   * 心理分析
   */
  const analyze = useCallback(
    async (
      assetId: string,
      description: string,
      tags: { scene: string; emotion: string; elements: string[] },
      explorationTendency?: string[]
    ): Promise<Omit<AnalyzeResponse, "taskId"> | void> => {
      setError(null);
      setStatus('generating');

      const { operationId, signal } = startOperation('analyze');

      const result = await fetchWithRetry<AnalyzeResponse>(
        '/api/analyze',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: operationId,
            assetId,
            description,
            tags,
            explorationTendency,
          }),
          signal,
        },
        { timeoutMs: TIMEOUT_TEXT * 3, maxRetries: 2, retryBaseMs: 800 }
      );

      if (!result.ok) {
        failTask(result.error ?? '分析失败');
        return;
      }

      const data = result.data!;
      setStatus('done');
      return {
        exploreNote: data.exploreNote,
        disclaimer: data.disclaimer,
        mode: data.mode,
        visualEvidence: data.visualEvidence,
        dreamClues: data.dreamClues,
        emotionalThread: data.emotionalThread,
        possibleConnections: data.possibleConnections,
        reflectionQuestions: data.reflectionQuestions,
        explorationTrace: data.explorationTrace,
      };
    },
    [startOperation, failTask]
  );

  /**
   * 主动取消
   */
  const cancel = useCallback(() => {
    op.cancel();
    setStatus('idle');
    setCurrentTaskId(null);
  }, [op]);

  return {
    ...session,
    status,
    error,
    currentTaskId,
    operationStatus: op.state.status,
    operationStage: op.state.stage,
    demoMode: false,
    getCurrentImageUrl,
    generateInitial,
    answerAgentAsk,
    refine,
    explore,
    analyze,
    cancel,
    clearError,
  };
}

// generateId helper export for compatibility
export { generateId };