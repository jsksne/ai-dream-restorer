// 受控资产读写 API
// GET /api/assets/[assetId] → 返回图片字节
// DELETE /api/assets/[assetId] → 删除资产

import {
  isAssetId,
  readAssetBytes,
  deleteAsset,
  AssetError,
} from "@/lib/assets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await context.params;
    if (!isAssetId(assetId)) {
      return Response.json({ error: "资产 ID 格式无效" }, { status: 400 });
    }
    const { bytes, mimeType } = await readAssetBytes(assetId, request.signal);
    return new Response(bytes as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    if (e instanceof AssetError) {
      return Response.json({ error: e.message, code: e.code }, { status: e.httpStatus });
    }
    if (e instanceof Error && /abort|cancel/i.test(e.message)) {
      return new Response(null, { status: 499 });
    }
    console.error("[/api/assets/:id] 错误:", e);
    return Response.json({ error: "内部错误" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await context.params;
    if (!isAssetId(assetId)) {
      return Response.json({ error: "资产 ID 格式无效" }, { status: 400 });
    }
    const removed = await deleteAsset(assetId);
    return Response.json({ removed });
  } catch (e) {
    if (e instanceof AssetError) {
      return Response.json({ error: e.message, code: e.code }, { status: e.httpStatus });
    }
    console.error("[/api/assets/:id DELETE] 错误:", e);
    return Response.json({ error: "内部错误" }, { status: 500 });
  }
}