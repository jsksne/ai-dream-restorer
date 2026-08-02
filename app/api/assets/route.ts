// 受控资产上传 API
// POST /api/assets
// 请求体：{ bytes: base64, mimeType: "image/png" | "image/jpeg" | "image/webp", purpose: AssetPurpose }
// 响应：{ assetId, mimeType, byteLength, purpose, createdAt }

import { storeAsset, AssetError, type AssetMime, type AssetPurpose } from "@/lib/assets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MIME: ReadonlyArray<AssetMime> = ["image/png", "image/jpeg", "image/webp"];
const ALLOWED_PURPOSE: ReadonlyArray<AssetPurpose> = [
  "generated",
  "dream-self-reference",
  "dream-self-canonical",
  "crop",
  "version",
];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      bytes?: string;
      mimeType?: AssetMime;
      purpose?: AssetPurpose;
    };
    if (typeof body.bytes !== "string") {
      return Response.json({ error: "bytes 为必填项" }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(body.mimeType as AssetMime)) {
      return Response.json({ error: "mimeType 必须是 png/jpeg/webp" }, { status: 400 });
    }
    if (!ALLOWED_PURPOSE.includes(body.purpose as AssetPurpose)) {
      return Response.json({ error: "purpose 不在白名单内" }, { status: 400 });
    }
    const bytes = Uint8Array.from(Buffer.from(body.bytes, "base64"));
    const stored = await storeAsset({
      bytes,
      mimeType: body.mimeType as AssetMime,
      purpose: body.purpose as AssetPurpose,
    });
    return Response.json(stored);
  } catch (e) {
    if (e instanceof AssetError) {
      return Response.json({ error: e.message, code: e.code }, { status: e.httpStatus });
    }
    console.error("[/api/assets] 错误:", e);
    return Response.json({ error: "内部错误" }, { status: 500 });
  }
}