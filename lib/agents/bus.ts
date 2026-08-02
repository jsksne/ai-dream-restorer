// ===== A2A 内存总线（与 OperationManager 协作版）=====
// EventEmitter + 全局 Map 存任务状态
// 变更：
// - 不再依赖单一全局 Map，由 OperationManager 管理生命周期
// - 保留向后兼容：旧 API（createTask / getTask / updateTaskStatus / failTask）仍可用
// - 新 API：emitOperationEvent / subscribeOperation

import { EventEmitter } from 'events';
import type { AgentTask, AgentMessage, AgentArtifact, AgentId, TaskStatus } from './types';
import type { OperationEvent } from '@/lib/operations/types';

/** 全局任务状态存储 */
const tasks = new Map<string, AgentTask>();

/** 全局事件总线 */
export const bus = new EventEmitter();
bus.setMaxListeners(50);

/** 总线事件名常量 */
export const BusEvents = {
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  MESSAGE_SENT: 'message:sent',
  ARTIFACT_PRODUCED: 'artifact:produced',
  AGENT_STATUS: 'agent:status',
  TASK_STREAM: 'task:stream',
  TASK_FAILED: 'task:failed',
  /** 新增：Operation 事件（与旧 A2A 协议独立） */
  OPERATION_EVENT: 'operation:event',
} as const;

/** 创建任务（向后兼容） */
export function createTask(taskId: string): AgentTask {
  const task: AgentTask = {
    id: taskId,
    status: 'submitted',
    messages: [],
    artifacts: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  tasks.set(taskId, task);
  bus.emit(BusEvents.TASK_CREATED, task);
  return task;
}

/** 读取任务 */
export function getTask(taskId: string): AgentTask | undefined {
  return tasks.get(taskId);
}

/** 列出所有任务（调试用） */
export function listTasks(): AgentTask[] {
  return Array.from(tasks.values());
}

/** 更新任务状态 */
export function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  activeAgent?: AgentId
): void {
  const task = tasks.get(taskId);
  if (!task) return;
  task.status = status;
  task.activeAgent = activeAgent;
  task.updatedAt = Date.now();
  bus.emit(BusEvents.TASK_UPDATED, task);
  if (activeAgent) {
    bus.emit(BusEvents.AGENT_STATUS, { taskId, agentId: activeAgent, status });
  }
}

/** 标记任务失败 */
export function failTask(taskId: string, error: string): void {
  const task = tasks.get(taskId);
  if (!task) return;
  task.status = 'failed';
  task.updatedAt = Date.now();
  bus.emit(BusEvents.TASK_FAILED, { taskId, error });
  bus.emit(BusEvents.TASK_UPDATED, task);
}

/** Agent 间流转消息 */
export function sendMessage(msg: AgentMessage): void {
  const task = tasks.get(msg.taskId);
  if (!task) return;
  task.messages.push(msg);
  task.updatedAt = Date.now();
  bus.emit(BusEvents.MESSAGE_SENT, msg);
}

/** Agent 产出 Artifact */
export function produceArtifact(artifact: AgentArtifact): void {
  const task = tasks.get(artifact.taskId);
  if (!task) return;
  task.artifacts.push(artifact);
  task.updatedAt = Date.now();
  bus.emit(BusEvents.ARTIFACT_PRODUCED, artifact);
}

/** 细流式 delta 推送 */
export function streamDelta(taskId: string, key: string, delta: string): void {
  bus.emit(BusEvents.TASK_STREAM, { taskId, agentId: key, delta });
}

/** 清理已完成任务 */
export function cleanupTask(taskId: string): void {
  tasks.delete(taskId);
}

/** 推送统一 Operation 事件（前端 useOperation 订阅） */
export function emitOperationEvent(event: OperationEvent): void {
  bus.emit(BusEvents.OPERATION_EVENT, event);
}

/** 订阅 Operation 事件；返回取消订阅函数 */
export function subscribeOperation(
  operationId: string,
  sequence: number,
  listener: (event: OperationEvent) => void
): () => void {
  const handler = (event: OperationEvent) => {
    if (event.operationId === operationId && event.sequence === sequence) {
      listener(event);
    }
  };
  bus.on(BusEvents.OPERATION_EVENT, handler);
  return () => bus.off(BusEvents.OPERATION_EVENT, handler);
}