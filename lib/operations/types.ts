// ===== Operation 类型定义（任务生命周期协议）=====
// 统一 generate / identify / explore / refine / analyze 的事件格式与终态

export type OperationKind =
  | "generate"
  | "identify"
  | "explore"
  | "refine"
  | "analyze";

export type OperationStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/** 单个阶段的稳定标识（UI 用来切换进度文案） */
export type OperationStage =
  | "understand-dream"
  | "compose-scene"
  | "generate-image"
  | "persist-and-map"
  | "lock-region"
  | "plan-branch"
  | "attach-tree"
  | "read-version"
  | "analyze-clues"
  | "synthesize-reflection"
  | "complete";

export interface OperationEvent {
  operationId: string;
  /** 单调递增序号（防止迟到事件覆盖新任务） */
  sequence: number;
  kind: OperationKind;
  status: OperationStatus;
  stage: OperationStage;
  message: string;
  retryCount: 0 | 1;
  artifactId?: string;
  errorCode?: string;
  timestamp: string;
}

export interface OperationSnapshot {
  operationId: string;
  sequence: number;
  kind: OperationKind;
  status: OperationStatus;
  stage: OperationStage;
  startedAt: number;
  updatedAt: number;
  /** 已发出事件数（终态冻结） */
  eventCount: number;
}

export type OperationListener = (event: OperationEvent) => void;

export const GENERATE_STAGES: ReadonlyArray<OperationStage> = [
  "understand-dream",
  "compose-scene",
  "generate-image",
  "persist-and-map",
];

export const EXPLORE_STAGES: ReadonlyArray<OperationStage> = [
  "lock-region",
  "plan-branch",
  "generate-image",
  "attach-tree",
];

export const ANALYZE_STAGES: ReadonlyArray<OperationStage> = [
  "read-version",
  "analyze-clues",
  "synthesize-reflection",
  "complete",
];

export const STAGE_LABEL: Record<OperationStage, string> = {
  "understand-dream": "理解梦境",
  "compose-scene": "组织场景",
  "generate-image": "生成图像",
  "persist-and-map": "保存并识别",
  "lock-region": "锁定区域",
  "plan-branch": "规划分支",
  "attach-tree": "接入探索树",
  "read-version": "读取版本",
  "analyze-clues": "分析线索",
  "synthesize-reflection": "汇总联想",
  complete: "完成",
};

export const TERMINAL_STATUSES: ReadonlyArray<OperationStatus> = [
  "completed",
  "failed",
  "cancelled",
];