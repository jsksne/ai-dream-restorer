// ===== PromptOptimizer Agent =====
// 提示词优化智能体：判断描述是否过短/模糊，决定追问 or 返回优化后描述
// 调用 Qwen2.5-7B-Instruct（轻量任务）

import { chat, AGENT_ASK_MODEL, extractJson } from '@/lib/siliconflow';
import { isVagueDescription } from '@/lib/utils';
import { sendMessage, produceArtifact } from './bus';
import type { AgentMessage, PromptOptimizerResult } from './types';

const SYSTEM_PROMPT =
  '你是一位梦境描述优化助手。用户会描述他们的梦境。' +
  '若描述过于简短或缺少场景细节，请提出 1-2 个简短的追问问题，帮助用户补全画面。' +
  '若描述已足够具体，请基于原描述补全画面氛围与视觉细节，输出一段 60-120 字的优化后描述（不要额外解释，仅输出描述本身）。' +
  '只输出纯 JSON，不要有任何其他文本。追问：' +
  '{"type":"question","question":"你的追问问题"}。优化：' +
  '{"type":"optimized","optimizedDescription":"优化后的描述"}。';

/**
 * PromptOptimizer Agent 入口
 *
 * @param taskId A2A Task ID
 * @param rawDescription 用户原始描述
 * @returns 追问 OR 优化后描述
 */
export async function runPromptOptimizer(
  taskId: string,
  rawDescription: string,
  signal?: AbortSignal
): Promise<PromptOptimizerResult> {
  // 1. orchestrator → prompt-optimizer 流转消息
  sendMessage({
    taskId,
    fromAgentId: 'orchestrator',
    toAgentId: 'prompt-optimizer',
    content: { rawDescription },
    timestamp: Date.now(),
  });

  // 2. 短路：明显过短直接追问（节省一次 LLM 调用）
  if (rawDescription.trim().length < 8) {
    const fallback: PromptOptimizerResult = {
      type: 'question',
      question: '能再详细描述一下这个梦吗？比如你看到了什么、当时的心情、场景是怎样的？',
    };
    produceArtifact({
      taskId,
      agentId: 'prompt-optimizer',
      type: 'question',
      data: { question: fallback.question },
      createdAt: Date.now(),
    });
    sendMessage({
      taskId,
      fromAgentId: 'prompt-optimizer',
      toAgentId: 'orchestrator',
      content: fallback,
      timestamp: Date.now(),
    });
    return fallback;
  }

  // 3. 调用 Qwen2.5-7B 判断
  let result: PromptOptimizerResult;
  try {
    const content = await chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: rawDescription },
      ],
      AGENT_ASK_MODEL,
      signal
    );

    try {
      const parsed = extractJson<PromptOptimizerResult>(content);
      if (parsed.type === 'question' && parsed.question) {
        result = { type: 'question', question: parsed.question };
      } else if (parsed.type === 'optimized' && parsed.optimizedDescription) {
        result = { type: 'optimized', optimizedDescription: parsed.optimizedDescription };
      } else {
        // 解析成功但格式异常 → 视为已优化（直接用原文）
        result = { type: 'optimized', optimizedDescription: rawDescription };
      }
    } catch {
      // JSON 解析失败 → 退化为原文（视为已优化）
      result = { type: 'optimized', optimizedDescription: rawDescription };
    }
  } catch {
    // 模型调用失败 → 降级：用 isVagueDescription 启发式判断
    if (isVagueDescription(rawDescription)) {
      result = {
        type: 'question',
        question: '能再补充一些细节吗？比如梦里的画面、人物或心情？',
      };
    } else {
      result = { type: 'optimized', optimizedDescription: rawDescription };
    }
  }

  // 4. 产出 Artifact + 回消息给 orchestrator
  produceArtifact({
    taskId,
    agentId: 'prompt-optimizer',
    type: result.type === 'question' ? 'question' : 'text',
    data: result,
    createdAt: Date.now(),
  });
  sendMessage({
    taskId,
    fromAgentId: 'prompt-optimizer',
    toAgentId: 'orchestrator',
    content: result,
    timestamp: Date.now(),
  } satisfies AgentMessage);

  return result;
}
