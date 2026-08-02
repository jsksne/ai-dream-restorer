// 用户回答追问 → 继续生成 API 薄壳
// POST /api/agent-ask
// 请求体：{ taskId, originalDescription, answer }

import { orchestrateGenerateResume } from '@/lib/agents/orchestrator';
import { errorResponse } from '@/lib/error-handler';
import { getProvider } from '@/lib/providers';
import { extractJson } from '@/lib/siliconflow';
import { validatePromptCoachReply, type PromptCoachReply } from '@/lib/prompt-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AgentAskRequest {
  taskId?: string;
  originalDescription?: string;
  answer?: string;
  mode?: string;
  round?: number;
}

function coachFallback(description: string, round: number): PromptCoachReply {
  const safeRound = Math.max(0, Math.min(2, Math.floor(round)));
  const prompts = [
    { question: "这个梦发生在哪里？", slot: "place", options: [{ id: "sea", label: "海面", value: "海面" }, { id: "forest", label: "森林", value: "森林" }, { id: "city", label: "城市", value: "城市" }] },
    { question: "当时最强烈的感受是什么？", slot: "emotion", options: [{ id: "calm", label: "平静", value: "平静" }, { id: "fear", label: "害怕", value: "害怕" }, { id: "curious", label: "好奇", value: "好奇" }] },
    { question: "画面里最想保留哪种质感？", slot: "sensory", options: [{ id: "light", label: "柔光", value: "柔和的光线" }, { id: "mist", label: "薄雾", value: "薄雾与潮湿空气" }, { id: "sound", label: "回声", value: "遥远的回声" }] },
  ] as const;
  const current = prompts[safeRound];
  if (safeRound >= 2) {
    return {
      ready: true,
      question: null,
      targetSlot: null,
      options: [],
      allowFreeText: false,
      summary: description.slice(0, 500),
      recommendedStyle: "电影感画面",
      missingHighImpactSlots: [],
      round: safeRound,
    };
  }
  return {
    ready: false,
    question: current.question,
    targetSlot: current.slot,
    options: [...current.options],
    allowFreeText: true,
    summary: description.slice(0, 500),
    recommendedStyle: "电影感画面",
    missingHighImpactSlots: [current.slot],
    round: safeRound,
  };
}

async function getCoachReply(description: string, round: number): Promise<PromptCoachReply> {
  const provider = getProvider();
  if (provider.mode !== 'live') return coachFallback(description, round);

  const safeRound = Math.max(0, Math.min(2, Math.floor(round)));
  try {
    const text = await provider.chat([
      {
        role: 'system',
        content: `你是 Oneira 的梦境提示词教练。根据用户目前的梦境描述，生成本轮最有信息价值的一个追问。只返回 JSON，不要 Markdown。\n\nJSON 格式：{"ready":boolean,"question":string|null,"targetSlot":"time"|"place"|"characters"|"perspective"|"emotion"|"event"|"sensory"|"dreamSelf"|null,"options":[{"id":string,"label":string,"value":string}],"allowFreeText":boolean,"summary":string,"recommendedStyle":string,"missingHighImpactSlots":[string],"round":number}\n\n规则：第 ${safeRound + 1} 轮；未完成时给出 2 到 4 个简短、互不重复的选项；问题与选项必须从描述中推断，不能使用固定模板；第 3 轮或信息已足够时设 ready=true。recommendedStyle 必须是一个图像风格描述。`,
      },
      { role: 'user', content: description.slice(0, 500) },
    ]);

    const parsed = validatePromptCoachReply(extractJson(text));
    return { ...parsed, round: safeRound };
  } catch (e) {
    // 模型调用或 JSON 解析失败时，降级为内置追问，避免整个请求 500
    console.warn(
      '[agent-ask] 对话智能体请求失败，降级为内置追问:',
      e instanceof Error ? e.message : e
    );
    return coachFallback(description, safeRound);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AgentAskRequest;

    if (!body.taskId || typeof body.taskId !== 'string') {
      return Response.json({ error: 'taskId 为必填项' }, { status: 400 });
    }
    if (!body.originalDescription || typeof body.originalDescription !== 'string') {
      return Response.json({ error: 'originalDescription 为必填项' }, { status: 400 });
    }
    if (!body.answer || typeof body.answer !== 'string') {
      return Response.json({ error: 'answer 为必填项' }, { status: 400 });
    }

    if (body.mode === "coach") {
      return Response.json(await getCoachReply(body.originalDescription, body.round ?? 0));
    }

    const finalDescription =
      `${body.originalDescription}\n[补充细节] ${body.answer}`.slice(0, 500);

    const result = await orchestrateGenerateResume(body.taskId, finalDescription);

    return Response.json({
      taskId: body.taskId,
      optimizedDescription: finalDescription,
      imageUrl: result.imageUrl,
      assetId: result.assetId,
      tags: result.tags,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
