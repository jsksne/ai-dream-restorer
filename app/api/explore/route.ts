// 探索 API 薄壳
// POST /api/explore
// 请求体：{ taskId, assetId, clickX, clickY, userHint? }

import { orchestrateExplore } from '@/lib/agents/orchestrator';
import { errorResponse } from '@/lib/error-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ExploreRequest {
  taskId?: string;
  assetId?: string;
  clickX?: number;
  clickY?: number;
  userHint?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExploreRequest;

    if (!body.taskId || typeof body.taskId !== 'string') {
      return Response.json({ error: 'taskId 为必填项' }, { status: 400 });
    }
    if (!body.assetId || typeof body.assetId !== 'string') {
      return Response.json({ error: 'assetId 为必填项' }, { status: 400 });
    }
    if (typeof body.clickX !== 'number' || typeof body.clickY !== 'number') {
      return Response.json({ error: 'clickX / clickY 为必填项且必须为数字' }, { status: 400 });
    }

    const userHint =
      typeof body.userHint === 'string' && body.userHint.length > 200
        ? body.userHint.slice(0, 200)
        : body.userHint;

    const result = await orchestrateExplore(
      body.taskId,
      body.assetId,
      body.clickX,
      body.clickY,
      userHint
    );

    return Response.json({
      taskId: body.taskId,
      element: result.element,
      imageUrl: result.genResult.imageUrl,
      assetId: result.genResult.assetId,
      tags: result.genResult.tags,
    });
  } catch (error) {
    return errorResponse(error);
  }
}