// 元素识别 API 薄壳
// POST /api/identify
// 请求体：{ taskId, assetId, clickX, clickY }

import { orchestrateIdentify } from '@/lib/agents/orchestrator';
import { errorResponse } from '@/lib/error-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface IdentifyRequest {
  taskId?: string;
  assetId?: string;
  clickX?: number;
  clickY?: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IdentifyRequest;

    if (!body.taskId || typeof body.taskId !== 'string') {
      return Response.json({ error: 'taskId 为必填项' }, { status: 400 });
    }
    if (!body.assetId || typeof body.assetId !== 'string') {
      return Response.json({ error: 'assetId 为必填项' }, { status: 400 });
    }
    if (typeof body.clickX !== 'number' || typeof body.clickY !== 'number') {
      return Response.json({ error: 'clickX / clickY 为必填项且必须为数字' }, { status: 400 });
    }

    const element = await orchestrateIdentify(
      body.taskId,
      body.assetId,
      body.clickX,
      body.clickY
    );

    return Response.json({ taskId: body.taskId, element });
  } catch (error) {
    return errorResponse(error);
  }
}