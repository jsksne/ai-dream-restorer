// ===== A2A Agent Card 注册表 =====
// 3 个 Agent 的硬编码 Card（O1）：中文名 + 中文描述 + capabilities
// 运行时可枚举（listAgents）查看已注册 agent

import type { AgentCard, AgentId } from './types';

/** Agent Card 注册表（硬编码，O1） */
export const AGENT_CARDS: Record<AgentId, AgentCard> = {
  'prompt-optimizer': {
    agentId: 'prompt-optimizer',
    name: '提示词优化智能体',
    description:
      '分析用户输入的梦境描述，若描述过于简短或模糊，主动追问以补全画面细节；描述充分时返回优化后的描述供生成智能体使用。',
    capabilities: {
      input: { rawDescription: 'string' },
      output: {
        type: '"question" | "optimized"',
        question: 'string?',
        optimizedDescription: 'string?',
      },
    },
  },
  'dream-generator': {
    agentId: 'dream-generator',
    name: '生成智能体',
    description:
      '基于优化后的描述调用图像生成 API 生成梦境画面，并通过 VLM 生成语义标签（含元素方位）。支持首次生成、微调、探索三种模式。',
    capabilities: {
      input: {
        mode: '"generate" | "refine" | "explore"',
        description: 'string',
        imageBase64: 'string?',
        strength: 'number?',
        saveAsVersion: 'boolean?',
      },
      output: { imageUrl: 'string', tags: 'SemanticTags' },
    },
  },
  'dream-analyzer': {
    agentId: 'dream-analyzer',
    name: '分析智能体',
    description:
      '基于用户标记的版本画面，调用 VLM 进行多模态视觉理解，并通过向量 RAG 检索释梦理论，生成四维度心理分析（释梦解读/情绪分析/睡眠评估/AI建议），细流式输出。',
    capabilities: {
      input: {
        imageUrl: 'string',
        description: 'string',
        explorationTendency: 'string?',
      },
      output: { dimensions: 'Array<{ title, content }>' },
    },
  },
};

/** 列出所有已注册 agent card */
export function listAgents(): AgentCard[] {
  return Object.values(AGENT_CARDS);
}

/** 根据 agentId 获取 Agent Card */
export function getAgentCard(agentId: AgentId): AgentCard {
  return AGENT_CARDS[agentId];
}
