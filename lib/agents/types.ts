// ===== A2A 多智能体协作总线类型定义 =====
// 借鉴 Google A2A 协议的 Agent Card / Message / Artifact / Task 抽象
// 仅实现 A 档抽象级（EventEmitter 内存总线，不实现 JSON-RPC over HTTP）

/** Agent 标识符 */
export type AgentId = 'prompt-optimizer' | 'dream-generator' | 'dream-analyzer';

/** Agent Card —— 每个 agent 的自我介绍 */
export interface AgentCard {
  agentId: AgentId;
  name: string;          // 中文名
  description: string;   // 中文描述
  capabilities: {
    input: Record<string, string>;   // 输入字段名 → 类型描述
    output: Record<string, string>;  // 输出字段名 → 类型描述
  };
}

/** Task 状态机：submitted → working → input-required → completed/failed */
export type TaskStatus =
  | 'submitted'
  | 'working'
  | 'input-required'
  | 'completed'
  | 'failed';

/** Agent 间流转的消息 */
export interface AgentMessage {
  taskId: string;
  fromAgentId: AgentId | 'orchestrator' | 'user';
  toAgentId: AgentId | 'orchestrator';
  content: unknown;
  timestamp: number;
}

/** Agent 产出的结构化结果类型 */
export type ArtifactType = 'text' | 'image' | 'tags' | 'analysis' | 'question';

/** Agent 产出的结构化结果 */
export interface AgentArtifact {
  taskId: string;
  agentId: AgentId;
  type: ArtifactType;
  data: unknown;
  createdAt: number;
}

/** A2A Task —— 任务状态机 + 消息历史 + 产出历史 */
export interface AgentTask {
  id: string;
  status: TaskStatus;
  messages: AgentMessage[];
  artifacts: AgentArtifact[];
  activeAgent?: AgentId;   // 当前正在处理的 agent
  createdAt: number;
  updatedAt: number;
}

/** PromptOptimizer 输出 */
export interface PromptOptimizerResult {
  type: 'question' | 'optimized';
  question?: string;
  optimizedDescription?: string;
}

/** DreamGenerator 输入模式 */
export type DreamGenMode = 'generate' | 'refine' | 'explore';

/** DreamGenerator 输入参数 */
export interface DreamGenInput {
  mode: DreamGenMode;
  description: string;
  imageBase64?: string;     // refine/explore 模式下的输入图（data URL）
  strength?: number;        // override 默认 strength
  saveAsVersion?: boolean;  // 探索存为新版本时为 true，触发打标签
}

/** DreamGenerator 输出 */
export interface DreamGenResult {
  imageUrl: string;         // 本地 URL（/generated/xxx.png）
  assetId?: string;         // 受控资产 ID
  tags: import('@/types').SemanticTags;
}

/** DreamAnalyzer 流式 delta 回调
 *
 * 第一个参数 key 是 deltaBuffer 的分组键：
 * - 对于多维度并行流式分析，使用维度名（'interpretation' / 'emotion' / 'sleep' / 'suggestion'）
 *   避免所有维度的 delta 混在同一个 agentId 键下
 * - 前端 useAgentStream.deltaBuffer[key] 累积每个维度的文本
 */
export type StreamDeltaCallback = (key: string, delta: string) => void;

/** DreamAnalyzer 单维度完成结果 */
export interface AnalysisDimensionResult {
  agentId: AgentId;
  title: string;
  content: string;
}
