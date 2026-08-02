// 心理分析 API 薄壳
// POST /api/analyze
// 请求体：{ taskId, assetId, description, tags, explorationTendency? }

import { orchestrateAnalyze } from '@/lib/agents/orchestrator';
import { errorResponse } from '@/lib/error-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AnalyzeRequest {
  taskId?: string;
  assetId?: string;
  description?: string;
  tags?: { scene: string; emotion: string; elements: string[] };
  explorationTendency?: string[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeRequest;

    if (!body.taskId || typeof body.taskId !== 'string') {
      return Response.json({ error: 'taskId 为必填项' }, { status: 400 });
    }
    if (!body.assetId || typeof body.assetId !== 'string') {
      return Response.json({ error: 'assetId 为必填项' }, { status: 400 });
    }
    if (!body.description || typeof body.description !== 'string') {
      return Response.json({ error: 'description 为必填项' }, { status: 400 });
    }

    const tags = body.tags ?? { scene: '未知', emotion: '未知', elements: [] };
    const description =
      body.description.length > 500 ? body.description.slice(0, 500) : body.description;

    const result = await orchestrateAnalyze(
      body.taskId,
      body.assetId,
      description,
      tags,
      body.explorationTendency
    );

    return Response.json({
      taskId: body.taskId,
      ...result,
    });
  } catch (error) {
    return errorResponse(error);
  }
}