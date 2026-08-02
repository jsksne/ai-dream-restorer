// ===== A2A Orchestrator 编排器（重构版）=====
// 变更：
// 1. 所有路由都通过 OperationManager 创建 operation，禁止跳过
// 2. 上游请求 signal 与 abort controller 关联，cancel 能传播到 provider
// 3. 旧 catch 中的 demo 替换已删除：取消或终态后不能再启动演示回退

import {
  createTask,
  updateTaskStatus,
  failTask,
  streamDelta,
  getTask,
  emitOperationEvent,
} from './bus';
import { runPromptOptimizer } from './prompt-optimizer';
import { runDreamGenerator, runElementIdentify } from './dream-generator';
import { streamAnalyze, type AnalysisArtifactResult } from './dream-analyzer';
import { getOperationManager } from '@/lib/operations/manager';
import type {
  OperationEvent,
  OperationStage,
} from '@/lib/operations/types';
import type { DreamGenInput, DreamGenResult, PromptOptimizerResult } from './types';

interface OrchestrationContext {
  operationId: string;
  sequence: number;
}

/** 获取当前 operation 的 signal */
function getSignal(ctx: OrchestrationContext): AbortSignal | undefined {
  return getOperationManager().signalOf(ctx.operationId);
}

/** 推送 Operation 事件 */
function emit(
  ctx: OrchestrationContext,
  init: {
    kind: OperationEvent['kind'];
    stage: OperationStage;
    message: string;
    artifactId?: string;
    retryCount?: 0 | 1;
    errorCode?: string;
  }
): OperationEvent | null {
  const mgr = getOperationManager();
  const event = mgr.emit(ctx.operationId, {
    status: init.stage === 'complete' ? 'completed' : 'running',
    stage: init.stage,
    message: init.message,
    artifactId: init.artifactId,
    retryCount: init.retryCount,
    errorCode: init.errorCode,
  });
  if (event) emitOperationEvent(event);
  return event;
}

/** 编排"首次生成"任务 */
export async function orchestrateGenerate(
  taskId: string,
  rawDescription: string,
  skipAsk = false
): Promise<PromptOptimizerResult> {
  const mgr = getOperationManager();
  const opId = `op-${taskId}`;
  mgr.create({ operationId: opId, kind: 'generate', sequence: 1 });
  const ctx: OrchestrationContext = { operationId: opId, sequence: 1 };
  createTask(taskId);

  try {
    if (skipAsk) {
      emit(ctx, { kind: 'generate', stage: 'compose-scene', message: '组织场景' });
      updateTaskStatus(taskId, 'working', 'dream-generator');
      const input: DreamGenInput = { mode: 'generate', description: rawDescription };
      const genResult = await runDreamGenerator(taskId, input, getSignal(ctx));
      emit(ctx, {
        kind: 'generate',
        stage: 'persist-and-map',
        message: '保存并识别',
        artifactId: genResult.assetId,
      });
      const task = getTask(taskId);
      if (task) {
        task.artifacts.push({
          taskId,
          agentId: 'dream-generator',
          type: 'image',
          data: genResult,
          createdAt: Date.now(),
        });
      }
      mgr.complete(opId, genResult.assetId);
      return { type: 'optimized', optimizedDescription: rawDescription };
    }

    emit(ctx, { kind: 'generate', stage: 'understand-dream', message: '理解梦境' });
    updateTaskStatus(taskId, 'working', 'prompt-optimizer');
    const optimizerResult = await runPromptOptimizer(taskId, rawDescription, getSignal(ctx));

    if (optimizerResult.type === 'question') {
      updateTaskStatus(taskId, 'input-required');
      return optimizerResult;
    }

    emit(ctx, { kind: 'generate', stage: 'compose-scene', message: '组织场景' });
    updateTaskStatus(taskId, 'working', 'dream-generator');
    const input: DreamGenInput = {
      mode: 'generate',
      description: optimizerResult.optimizedDescription || rawDescription,
    };
    const genResult = await runDreamGenerator(taskId, input, getSignal(ctx));
    emit(ctx, {
      kind: 'generate',
      stage: 'persist-and-map',
      message: '保存并识别',
      artifactId: genResult.assetId,
    });
    const task = getTask(taskId);
    if (task) {
      task.artifacts.push({
        taskId,
        agentId: 'dream-generator',
        type: 'image',
        data: genResult,
        createdAt: Date.now(),
      });
    }
    mgr.complete(opId, genResult.assetId);
    return optimizerResult;
  } catch (e) {
    mgr.fail(opId, 'generate_failed', e instanceof Error ? e.message : '生成失败');
    failTask(taskId, e instanceof Error ? e.message : '生成失败');
    throw e;
  }
}

/** 编排"用户回答追问后继续生成"任务 */
export async function orchestrateGenerateResume(
  taskId: string,
  finalDescription: string
): Promise<DreamGenResult> {
  const mgr = getOperationManager();
  const opId = `op-resume-${taskId}`;
  mgr.create({ operationId: opId, kind: 'generate', sequence: 1 });
  const ctx: OrchestrationContext = { operationId: opId, sequence: 1 };
  try {
    emit(ctx, { kind: 'generate', stage: 'compose-scene', message: '组织场景' });
    updateTaskStatus(taskId, 'working', 'dream-generator');
    const input: DreamGenInput = { mode: 'generate', description: finalDescription };
    const genResult = await runDreamGenerator(taskId, input, getSignal(ctx));
    emit(ctx, {
      kind: 'generate',
      stage: 'persist-and-map',
      message: '保存并识别',
      artifactId: genResult.assetId,
    });
    updateTaskStatus(taskId, 'completed');
    mgr.complete(opId, genResult.assetId);
    return genResult;
  } catch (e) {
    mgr.fail(opId, 'generate_resume_failed', e instanceof Error ? e.message : '微调失败');
    failTask(taskId, e instanceof Error ? e.message : '微调失败');
    throw e;
  }
}

/** 编排"微调"任务 */
export async function orchestrateRefine(
  taskId: string,
  description: string,
  assetId: string
): Promise<DreamGenResult> {
  const mgr = getOperationManager();
  const opId = `op-refine-${taskId}`;
  mgr.create({ operationId: opId, kind: 'refine', sequence: 1 });
  const ctx: OrchestrationContext = { operationId: opId, sequence: 1 };
  createTask(taskId);
  try {
    emit(ctx, { kind: 'refine', stage: 'compose-scene', message: '组织场景' });
    updateTaskStatus(taskId, 'working', 'dream-generator');
    const input: DreamGenInput = {
      mode: 'refine',
      description,
      imageBase64: assetId,
      strength: 0.4,
    };
    const genResult = await runDreamGenerator(taskId, input, getSignal(ctx));
    emit(ctx, {
      kind: 'refine',
      stage: 'persist-and-map',
      message: '保存并识别',
      artifactId: genResult.assetId,
    });
    updateTaskStatus(taskId, 'completed');
    mgr.complete(opId, genResult.assetId);
    return genResult;
  } catch (e) {
    mgr.fail(opId, 'refine_failed', e instanceof Error ? e.message : '微调失败');
    failTask(taskId, e instanceof Error ? e.message : '微调失败');
    throw e;
  }
}

/** 编排"探索"任务 */
export async function orchestrateExplore(
  taskId: string,
  assetId: string,
  clickX: number,
  clickY: number,
  userHint?: string
): Promise<{ element: string; genResult: DreamGenResult }> {
  const mgr = getOperationManager();
  const opId = `op-explore-${taskId}`;
  mgr.create({ operationId: opId, kind: 'explore', sequence: 1 });
  const ctx: OrchestrationContext = { operationId: opId, sequence: 1 };
  createTask(taskId);
  try {
    emit(ctx, { kind: 'explore', stage: 'lock-region', message: '锁定区域' });
    updateTaskStatus(taskId, 'working', 'dream-generator');
    const element = await runElementIdentify(taskId, assetId, clickX, clickY, getSignal(ctx));
    emit(ctx, { kind: 'explore', stage: 'plan-branch', message: '规划分支' });
    const description = userHint?.trim()
      ? `${userHint.trim()}（聚焦：${element}）`
      : `深入探索画面中的${element}，镜头拉近，呈现该元素的子梦境`;
    const input: DreamGenInput = {
      mode: 'explore',
      description,
      imageBase64: assetId,
      strength: 0.6,
      saveAsVersion: false,
    };
    const genResult = await runDreamGenerator(taskId, input, getSignal(ctx));
    emit(ctx, {
      kind: 'explore',
      stage: 'attach-tree',
      message: '接入探索树',
      artifactId: genResult.assetId,
    });
    updateTaskStatus(taskId, 'completed');
    mgr.complete(opId, genResult.assetId);
    return { element, genResult };
  } catch (e) {
    mgr.fail(opId, 'explore_failed', e instanceof Error ? e.message : '探索失败');
    failTask(taskId, e instanceof Error ? e.message : '探索失败');
    throw e;
  }
}

/** 编排"元素识别"任务 */
export async function orchestrateIdentify(
  taskId: string,
  assetId: string,
  clickX: number,
  clickY: number
): Promise<string> {
  const mgr = getOperationManager();
  const opId = `op-identify-${taskId}`;
  mgr.create({ operationId: opId, kind: 'identify', sequence: 1 });
  const ctx: OrchestrationContext = { operationId: opId, sequence: 1 };
  createTask(taskId);
  try {
    emit(ctx, { kind: 'identify', stage: 'lock-region', message: '识别元素' });
    updateTaskStatus(taskId, 'working', 'dream-generator');
    const element = await runElementIdentify(taskId, assetId, clickX, clickY, getSignal(ctx));
    emit(ctx, { kind: 'identify', stage: 'complete', message: '识别完成' });
    updateTaskStatus(taskId, 'completed');
    mgr.complete(opId);
    return element;
  } catch (e) {
    mgr.fail(opId, 'identify_failed', e instanceof Error ? e.message : '识别失败');
    failTask(taskId, e instanceof Error ? e.message : '识别失败');
    throw e;
  }
}

/** 编排"心理分析"任务 */
export async function orchestrateAnalyze(
  taskId: string,
  assetId: string,
  description: string,
  tags: { scene: string; emotion: string; elements: string[] },
  explorationTendency?: string[]
): Promise<AnalysisArtifactResult & { exploreNote: string | null }> {
  const mgr = getOperationManager();
  const opId = `op-analyze-${taskId}`;
  mgr.create({ operationId: opId, kind: 'analyze', sequence: 1 });
  const ctx: OrchestrationContext = { operationId: opId, sequence: 1 };
  createTask(taskId);
  try {
    emit(ctx, { kind: 'analyze', stage: 'read-version', message: '读取版本' });
    updateTaskStatus(taskId, 'working', 'dream-analyzer');
    const result = await streamAnalyze(
      taskId,
      assetId,
      description,
      tags,
      explorationTendency,
      (key, delta) => streamDelta(taskId, key, delta),
      getSignal(ctx)
    );
    emit(ctx, { kind: 'analyze', stage: 'synthesize-reflection', message: '汇总联想' });
    emit(ctx, { kind: 'analyze', stage: 'complete', message: '完成' });
    updateTaskStatus(taskId, 'completed');
    mgr.complete(opId);
    return result;
  } catch (e) {
    mgr.fail(opId, 'analyze_failed', e instanceof Error ? e.message : '分析失败');
    failTask(taskId, e instanceof Error ? e.message : '分析失败');
    throw e;
  }
}