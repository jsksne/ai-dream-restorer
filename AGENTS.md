# AGENTS.md — Oneira AI 编码指南

## 项目概述

Oneira 是 AI 梦境还原器，基于 Next.js 16 + React 19 + Tailwind CSS v4 + Zustand 构建。核心是 A2A 多智能体协作总线（借鉴 Google A2A 协议抽象），通过 EventEmitter 内存总线编排 3 个 Agent 完成梦境生成、探索和心理分析。

## A2A 架构

### 核心抽象（lib/agents/types.ts）

- **AgentCard**：Agent 元信息（id / name / description / capabilities），硬编码在 `lib/agents/registry.ts`
- **Message**：Agent 间通信载体（from / to / content / type）
- **Artifact**：Agent 产出物（type: image / tags / analysis / question / exploreNote）
- **Task**：任务状态容器（status: working / input-required / completed / failed）

### 总线（lib/agents/bus.ts）

- 基于 Node.js EventEmitter + 全局 Map 存储 Task 状态
- `createTask` / `getTask` / `updateTaskStatus` / `failTask` / `cleanupTask`
- `streamDelta`：推送流式 delta（心理分析逐字内容）
- `onArtifact` / `onStatusChange`：事件订阅

### 编排器（lib/agents/orchestrator.ts）

4 种编排函数：
- `orchestrateGenerate(taskId, description, skipAsk?)`：首次生成（PromptOptimizer → DreamGenerator）
- `orchestrateRefine(taskId, description, imageBase64)`：微调（直接 DreamGenerator refine 模式）
- `orchestrateExplore(taskId, imageUrl, clickX, clickY, userHint?)`：探索（VLM 识别 + DreamGenerator explore 模式）
- `orchestrateAnalyze(taskId, imageUrl, description, tags, explorationTendency?)`：心理分析（DreamAnalyzer 4 维度并行 + 串行建议）

### SSE 单端点（app/api/stream/route.ts）

前端通过 `GET /api/stream?taskId=xxx` 订阅任务状态。总线事件通过 SSE 透传：
- `status`：Agent 状态变更
- `delta`：流式内容增量（心理分析逐字）
- `artifact`：Agent 产出物

前端 `hooks/useAgentStream.ts`（Zustand store）管理 SSE 订阅和 deltaBuffer。

## 编码规范

### 分层规则

- **保留档**（不可修改签名）：`types/index.ts`、`hooks/useSession.ts`、`lib/utils.ts`、`lib/dream-rag.ts`
- **扩展档**（可加不可改旧）：`lib/siliconflow.ts`、`lib/dream-rag.ts`
- **推倒重做档**（可自由修改）：`app/api/*`、`components/*`、`hooks/useDreamGeneration.ts`、`hooks/useAgentStream.ts`

### UI 组件

- 纯 Tailwind CSS，手写 Modal / Tooltip / Toast（不依赖 Radix UI）
- 暗夜梦境沉浸式风格：深紫黑主色调 + 薰衣草 accent
- GSAP 仅用于图像 reveal 和镜头切换动画

### Agent Card

- 描述必须为中文
- 硬编码在 `lib/agents/registry.ts`，不从远程加载

### 会话管理

- localStorage 持久化 + 清空会话按钮
- 版本树（VersionNode.parentId 串联）和探索路径（ExploreNode.parentExploreId 串联）分离存储

### 错误处理

- 网络错误必须区分 timeout / 4xx / 5xx / offline，提供重试按钮
- 演示容灾：API 失败时自动切换到 `/api/demo`，返回预置数据
- `safeFetch` 包装器内置 30 秒超时，超时后触发容灾

### 测试

- 单元测试：Vitest + Testing Library（78 个测试）
- 集成测试：Chrome DevTools MCP 3 轮完整流程验证
- 测试文件与源文件同目录：`*.test.tsx` / `*.test.ts`

## 常用命令

```bash
npm run dev          # 启动开发服务器
npm test             # 运行单元测试
npm run lint         # ESLint 检查
npx tsc --noEmit     # TypeScript 类型检查
```
