// ===== Demo 容灾 API =====
// 仅在用户主动切换到演示模式时使用
// 测试环境永远不应该走到这里

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    {
      error: '演示模式已禁用。请配置真实 API Key 后重试。',
      kind: 'client',
    },
    { status: 503 }
  );
}

export async function GET() {
  return NextResponse.json({ available: false }, { status: 404 });
}