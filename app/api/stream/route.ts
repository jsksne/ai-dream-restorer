// 统一 Operation 事件 SSE 端点
// GET /api/stream?operationId=xxx&sequence=yyy
// 推送 OperationEvent 阶段进度、artifact、delta

import { subscribeOperation } from '@/lib/agents/bus';
import type { OperationEvent } from '@/lib/operations/types';
import { getOperationManager } from '@/lib/operations/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const operationId = searchParams.get('operationId');
  const sequence = parseInt(searchParams.get('sequence') ?? '0', 10);

  if (!operationId) {
    return new Response('Missing operationId', { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const safeSend = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // ignore
        }
      };

      // 推送初始快照
      const mgr = getOperationManager();
      const snap = mgr.publicSnapshot(operationId);
      if (snap) {
        safeSend({ type: 'operation:snapshot', snapshot: snap });
      } else {
        safeSend({ type: 'operation:not_found', operationId });
      }

      // 订阅后续事件
      const unsub = subscribeOperation(operationId, sequence, (event: OperationEvent) => {
        safeSend({ type: 'operation:event', event });
      });

      // 心跳
      const heartbeat = setInterval(() => safeSend({ type: 'ping' }), 15_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        unsub();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}