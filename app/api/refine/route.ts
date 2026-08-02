// 微调 API 薄壳
// POST /api/refine
// 请求体：{ taskId, prompt, assetId }

import { orchestrateRefine } from '@/lib/agents/orchestrator';
import { errorResponse } from '@/lib/error-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RefineRequest {
  taskId?: string;
  prompt?: string;
  assetId?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RefineRequest;

    if (!body.taskId || typeof body.taskId !== 'string') {
      return Response.json({ error: 'taskId 为必填项' }, { status: 400 });
    }
    if (!body.prompt || typeof body.prompt !== 'string') {
      return Response.json({ error: 'prompt 为必填项' }, { status: 400 });
    }
    if (!body.assetId || typeof body.assetId !== 'string') {
      return Response.json({ error: 'assetId 为必填项' }, { status: 400 });
    }

    const prompt = body.prompt.length > 500 ? body.prompt.slice(0, 500) : body.prompt;
    const result = await orchestrateRefine(body.taskId, prompt, body.assetId);

    return Response.json({
      taskId: body.taskId,
      imageUrl: result.imageUrl,
      assetId: result.assetId,
      tags: result.tags,
    });
  } catch (error) {
    return errorResponse(error);
  }
}