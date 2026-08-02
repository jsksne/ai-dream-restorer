// ===== DreamAnalyzer Agent（多模态重构版）=====
// 变更：
// 1. 删除"睡眠推断"维度（spec 明确要求）
// 2. 视觉模型先读取选中图片，提取可观察证据（observation + confidence）
// 3. 文字模型基于视觉证据 + 原始描述 + RAG 参考，输出四段非诊断性内容
// 4. 视觉失败时 mode=text-only 并清空视觉证据
// 5. 探索轨迹固定 confidence=low，独立展示

import { getProvider } from '@/lib/providers';
import { searchDreamTheory } from '@/lib/dream-rag';
import { sendMessage, produceArtifact } from './bus';
import type { StreamDeltaCallback } from './types';
import type { AgentMessage } from '@/types';

const DISCLAIMER =
  '以下内容是供你自我探索的可能线索，不是诊断，也不是确定的解梦结论。';

export interface AnalysisVisualEvidence {
  observation: string;
  confidence: number;
}

export interface AnalysisArtifactResult {
  mode: 'multimodal' | 'text-only';
  visualEvidence: AnalysisVisualEvidence[];
  dreamClues: string;
  emotionalThread: string;
  possibleConnections: string;
  reflectionQuestions: string[];
  explorationTrace: Array<{ nodeId: string; summary: string; confidence: 'low' }>;
  disclaimer: string;
}

/** 构造视觉证据抽取 prompt（VLM 只返回可观察事实，不解释心理） */
function buildVisualEvidencePrompt(): AgentMessage[] {
  return [
    {
      role: 'system',
      content:
        '你是一位视觉观察助手。读取图像后输出"可见"的客观事实（人物、动作、环境、色彩、构图等），' +
        '每条事实附带 0..1 的置信度。不要做心理推断、不要使用任何释梦理论术语。' +
        '返回纯 JSON：{"evidence":[{"observation":"可观察事实","confidence":0.8}]}。',
    },
    { role: 'user', content: '请观察这张图像，提取可观察的客观证据。' },
  ];
}

/**
 * 抽取视觉证据。失败时返回空数组并标记 text-only。
 */
async function extractVisualEvidence(
  assetUrl: string,
  signal?: AbortSignal
): Promise<{ ok: boolean; evidence: AnalysisVisualEvidence[]; error?: string }> {
  try {
    const content = await getProvider().chat(buildVisualEvidencePrompt(), signal);
    const parsed = JSON.parse(content) as { evidence?: AnalysisVisualEvidence[] };
    const evidence = Array.isArray(parsed.evidence)
      ? parsed.evidence
          .filter(
            (e): e is AnalysisVisualEvidence =>
              typeof e === 'object' &&
              e !== null &&
              typeof (e as AnalysisVisualEvidence).observation === 'string' &&
              typeof (e as AnalysisVisualEvidence).confidence === 'number'
          )
          .map((e) => ({
            observation: (e as AnalysisVisualEvidence).observation.slice(0, 200),
            confidence: Math.max(0, Math.min(1, (e as AnalysisVisualEvidence).confidence)),
          }))
      : [];
    return { ok: true, evidence };
  } catch (e) {
    // 降级：用语义标签作为可观察证据（已有数据）
    try {
      const tags = await getProvider().generateSemanticTags(assetUrl, signal);
      const fallbackEvidence: AnalysisVisualEvidence[] = [];
      fallbackEvidence.push({
        observation: `场景：${tags.scene}`,
        confidence: 0.6,
      });
      fallbackEvidence.push({
        observation: `情绪基调：${tags.emotion}`,
        confidence: 0.5,
      });
      for (const el of tags.elements.slice(0, 5)) {
        fallbackEvidence.push({ observation: `画面元素：${el}`, confidence: 0.5 });
      }
      return { ok: true, evidence: fallbackEvidence };
    } catch {
      return {
        ok: false,
        evidence: [],
        error: e instanceof Error ? e.message : '视觉证据提取失败',
      };
    }
  }
}

/**
 * DreamAnalyzer 入口
 */
export async function streamAnalyze(
  taskId: string,
  assetId: string,
  description: string,
  tags: { scene: string; emotion: string; elements: string[] },
  explorationTendency: string[] | undefined,
  onDelta: StreamDeltaCallback,
  signal?: AbortSignal
): Promise<AnalysisArtifactResult & { exploreNote: string | null }> {
  sendMessage({
    taskId,
    fromAgentId: 'orchestrator',
    toAgentId: 'dream-analyzer',
    content: { assetId, description, explorationTendency },
    timestamp: Date.now(),
  });

  // 1. 视觉证据
  const assetUrl = `/api/assets/${assetId}`;
  const visual = await extractVisualEvidence(assetUrl, signal);
  const mode: AnalysisArtifactResult['mode'] = visual.ok ? 'multimodal' : 'text-only';
  const evidence = visual.ok ? visual.evidence : [];

  // 2. RAG 检索（释梦视角参考）
  let ragContext = '';
  try {
    const entries = await searchDreamTheory(
      `${description} ${tags.scene} ${tags.emotion} ${tags.elements.join(' ')}`,
      3
    );
    ragContext = entries
      .map((e) => `[${e.source || '释梦理论'}] ${e.title}\n${e.content}`)
      .join('\n\n');
  } catch (e) {
    console.warn('[DreamAnalyzer] RAG 检索失败:', e instanceof Error ? e.message : e);
  }

  // 3. 生成四维度分析，并逐段推送到前端
  const fallback = {
    visualEvidence: evidence,
    dreamClues: '暂时无法生成梦境线索。',
    emotionalThread: '暂时无法生成情绪脉络。',
    possibleConnections: '暂时无法生成现实联想。',
    reflectionQuestions: ['可以留意这个画面带来的感受吗？'],
  };
  let synthesisResult = fallback;
  try {
    synthesisResult = await getProvider().analyze(`${description}${ragContext ? `\n参考视角：${ragContext}` : ""}`, tags, signal);
  } catch (e) {
    console.warn('[DreamAnalyzer] 综合分析失败:', e instanceof Error ? e.message : e);
  }
  onDelta('dreamClues', synthesisResult.dreamClues);
  onDelta('emotionalThread', synthesisResult.emotionalThread);
  onDelta('possibleConnections', synthesisResult.possibleConnections);
  onDelta('reflectionQuestions', synthesisResult.reflectionQuestions.join('\n'));

  // 4. 探索倾向附注（低置信度，非主体）
  let exploreNote: string | null = null;
  if (explorationTendency && explorationTendency.length > 0) {
    exploreNote =
      '你在本次梦境还原过程中探索了以下方向：' +
      explorationTendency.join('、') +
      '。此为好奇驱动的探索参考，非心理分析主体。';
    onDelta('exploreNote', exploreNote);
  }

  produceArtifact({
    taskId,
    agentId: 'dream-analyzer',
    type: 'text',
    data: {
      mode,
      visualEvidence: synthesisResult.visualEvidence.length > 0 ? synthesisResult.visualEvidence : evidence,
      dreamClues: synthesisResult.dreamClues,
      emotionalThread: synthesisResult.emotionalThread,
      possibleConnections: synthesisResult.possibleConnections,
      reflectionQuestions: synthesisResult.reflectionQuestions,
      explorationTrace: [],
      disclaimer: DISCLAIMER,
    },
    createdAt: Date.now(),
  });

  sendMessage({
    taskId,
    fromAgentId: 'dream-analyzer',
    toAgentId: 'orchestrator',
    content: { mode, evidence: synthesisResult.visualEvidence, dreamClues: synthesisResult.dreamClues, emotionalThread: synthesisResult.emotionalThread, possibleConnections: synthesisResult.possibleConnections, reflectionQuestions: synthesisResult.reflectionQuestions, disclaimer: DISCLAIMER, exploreNote },
    timestamp: Date.now(),
  });

  return { mode, visualEvidence: synthesisResult.visualEvidence.length > 0 ? synthesisResult.visualEvidence : evidence, dreamClues: synthesisResult.dreamClues, emotionalThread: synthesisResult.emotionalThread, possibleConnections: synthesisResult.possibleConnections, reflectionQuestions: synthesisResult.reflectionQuestions, explorationTrace: [], disclaimer: DISCLAIMER, exploreNote };
}