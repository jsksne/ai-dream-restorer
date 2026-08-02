// 首次生成 API 薄壳
// POST /api/generate
// 请求体：{ taskId, prompt, skipAsk? }

import { orchestrateGenerate } from '@/lib/agents/orchestrator';
import { errorResponse } from '@/lib/error-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface GenerateRequest {
  taskId?: string;
  prompt?: string;
  skipAsk?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequest;

    if (!body.taskId || typeof body.taskId !== 'string') {
      return Response.json({ error: 'taskId 为必填项' }, { status: 400 });
    }
    if (!body.prompt || typeof body.prompt !== 'string') {
      return Response.json({ error: 'prompt 为必填项' }, { status: 400 });
    }

    const prompt = body.prompt.length > 500 ? body.prompt.slice(0, 500) : body.prompt;
    const skipAsk = body.skipAsk === true;

    const optimizerResult = await orchestrateGenerate(body.taskId, prompt, skipAsk);

    if (optimizerResult.type === 'question') {
      return Response.json({
        taskId: body.taskId,
        needAsk: true,
        question: optimizerResult.question,
      });
    }

    const { getTask } = await import('@/lib/agents/bus');
    const task = getTask(body.taskId);
    const imageArtifact = task?.artifacts.findLast(
      (a) => a.type === 'image' && a.agentId === 'dream-generator'
    );
    const data = imageArtifact?.data as { imageUrl: string; tags: unknown; assetId?: string } | undefined;

    return Response.json({
      taskId: body.taskId,
      needAsk: false,
      optimizedDescription: optimizerResult.optimizedDescription,
      imageUrl: data?.imageUrl,
      assetId: data?.assetId,
      tags: data?.tags,
    });
  } catch (error) {
    return errorResponse(error);
  }
}