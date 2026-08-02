// ===== Oneira 类型定义（v2 无限探索本地版）=====

/** 元素方位（兼容旧字段） */
export type ElementRegion = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface ElementPosition {
  name: string;
  region: ElementRegion;
}

export interface SemanticTags {
  scene: string;
  emotion: string;
  elements: string[];
  elementPositions?: ElementPosition[];
}

/** 0..1 归一化矩形（用于场景区域图） */
export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SceneRegion {
  id: string;
  label: string;
  box: NormalizedBox;
  confidence: number;
}

/** 视角 */
export type DreamPerspective = 'first-person' | 'third-person' | 'observer-without-self';

/** 节点来源 */
export type NodeOrigin = 'remembered' | 'ai-exploration';

/** 探索节点（递归树，使用节点字典 + parentId） */
export interface DreamNode {
  id: string;
  parentId: string | null;
  childIds: string[];
  assetId: string;
  prompt: string;
  branchLabel: string;
  origin: NodeOrigin;
  sourceRegion?: NormalizedBox;
  sceneRegions: SceneRegion[];
  createdAt: string;
}

/** 版本（用户标记的候选版本） */
export interface DreamVersion {
  id: string;
  nodeId: string;
  title: string;
  isClosest: boolean;
  createdAt: string;
}

/** 心理分析结果 */
export interface AnalysisArtifact {
  mode: 'multimodal' | 'text-only';
  visualEvidence: Array<{ observation: string; confidence: number }>;
  dreamClues: string;
  emotionalThread: string;
  possibleConnections: string;
  reflectionQuestions: string[];
  explorationTrace: Array<{ nodeId: string; summary: string; confidence: 'low' }>;
  disclaimer: string;
  createdAt: string;
}

/** Dream Self 档案 */
export interface DreamSelfProfile {
  id: string;
  name: string;
  description: string;
  referenceAssetId: string | null;
  canonicalAssetId: string | null;
  signatureTraits: string[];
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 项目模型 */
export interface DreamProject {
  schemaVersion: 2;
  id: string;
  title: string;
  originalDescription: string;
  refinedPrompt: string;
  perspective: DreamPerspective;
  activeDreamSelfId: string | null;
  rootNodeId: string | null;
  activeNodeId: string | null;
  nodes: Record<string, DreamNode>;
  versions: DreamVersion[];
  selectedVersionId: string | null;
  analysis: AnalysisArtifact | null;
  assetIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** API 请求类型 */
export interface Text2ImageRequest {
  prompt: string;
  imageSize?: string;
}

export interface Img2ImgRequest {
  prompt: string;
  assetId: string;
  mode: 'refine' | 'explore';
}

export interface AgentRequest {
  messages: AgentMessage[];
  stream?: boolean;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/** 生成状态（前端 UI 用） */
export type GenerationStatus = 'idle' | 'asking' | 'generating' | 'tagging' | 'done' | 'error';

/** 旧版本兼容：保留 ExploreNode/VersionNode 类型以避免破坏现有组件 */
export interface VersionNode {
  id: string;
  prompt: string;
  imageUrl: string;
  parentId: string | null;
  semanticTags: SemanticTags;
  depth: number;
  createdAt: number;
}

export interface ExploreNode {
  id: string;
  versionId: string;
  parentExploreId: string | null;
  element: string;
  explorePrompt: string;
  imageUrl: string;
  semanticTags: SemanticTags;
  depth: number;
  createdAt: number;
}

/** 旧的会话状态（向后兼容） */
export interface SessionState {
  versionTree: VersionNode[];
  explorePaths: Record<string, ExploreNode[]>;
  currentVersionId: string | null;
  currentExplorePath: ExploreNode[] | null;
  currentExploreIndex: number;
  analysisTargetId: string | null;
}

export type ActionType = 'initial' | 'refine' | 'auto-explore' | 'guided-explore';
export type AgentPhase = 'describe' | 'refine' | 'explore' | 'analyze';