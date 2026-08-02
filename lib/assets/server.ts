// ===== 受控资产仓库（server-only）=====
// 所有上传图片经过 UUID 校验、MIME 白名单、文件签名检查和大小限制后落盘到 .oneira-data/assets/
// 业务路由只能通过 assetId 访问图片，禁止路径字符串进入文件读取
//
// 路径穿越防护：
// - assetId 必须严格匹配 UUID v4 格式（regex）
// - 禁止 ..、/、\\、:、绝对路径、URL 编码后的路径穿越
// - 文件扩展名来自白名单映射
// - 拒绝超过 10 MiB 的上传

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type AssetMime = "image/png" | "image/jpeg" | "image/webp";

export type AssetPurpose =
  | "generated"
  | "dream-self-reference"
  | "dream-self-canonical"
  | "crop"
  | "version";

export interface StoredAsset {
  id: string;
  mimeType: AssetMime;
  byteLength: number;
  purpose: AssetPurpose;
  createdAt: string;
}

const ALLOWED_MIME: ReadonlyArray<AssetMime> = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB

// UUID v4 严格匹配（小写十六进制）
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MIME_TO_EXT: Record<AssetMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** 解析资产根目录：默认 .oneira-data/assets，可被 ONEIRA_DATA_DIR 覆盖 */
function dataRoot(): string {
  const env = process.env.ONEIRA_DATA_DIR;
  if (env && env.trim().length > 0) {
    // 绝对路径与相对路径都允许（仅服务进程内可见，攻击者无法控制）
    const base = path.isAbsolute(env) ? env : path.resolve(process.cwd(), env);
    return path.join(base, "assets");
  }
  return path.resolve(process.cwd(), ".oneira-data", "assets");
}

/** 初始化数据目录（幂等） */
export async function ensureAssetRoot(): Promise<void> {
  const root = dataRoot();
  await fs.mkdir(root, { recursive: true });
}

/** 校验 assetId 格式：拒绝任何包含路径分隔符或不是 UUID 的输入 */
export function isAssetId(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

/** 检测被污染的输入：路径穿越、URL 编码、绝对路径、Windows 盘符 */
export function looksLikePathTraversal(value: string): boolean {
  if (value.length === 0) return false;
  // 解码后再次检测（防止双重 URL 编码）
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return true;
  }
  const patterns: ReadonlyArray<RegExp> = [
    /\.\./,
    /^\/[^/]/,
    /^[a-zA-Z]:[\\/]/,
    /^[\\/]/,
    /[\\/]\.\.[\\/]/,
    /%2e%2e/i,
    /%2f/i,
    /%5c/i,
  ];
  if (patterns.some((re) => re.test(value) || re.test(decoded))) return true;
  // UUID 含分隔符是正常的；其它任何含 / 或 \ 的字符都拒绝
  if (/[\\/]/.test(value)) return true;
  return false;
}

/**
 * 计算指定 assetId 的磁盘绝对路径。
 * 强制通过 isAssetId 校验，绕过校验的请求一律抛错。
 */
export async function resolveAssetPath(assetId: string): Promise<string> {
  if (!isAssetId(assetId)) {
    throw new AssetError("invalid-id", "资产 ID 格式无效");
  }
  await ensureAssetRoot();
  const root = dataRoot();
  const found = ALLOWED_MIME.map((m) => path.join(root, `${assetId}.${MIME_TO_EXT[m]}`));
  for (const candidate of found) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // 继续尝试下一个扩展名
    }
  }
  throw new AssetError("not-found", "资产不存在", 404);
}

/**
 * 存储上传的图像字节，返回不可猜测的 assetId。
 * - 拒绝超过 MAX_BYTES 的输入
 * - 拒绝不在白名单的 MIME
 * - 拒绝与文件签名不一致的 MIME
 */
export async function storeAsset(input: {
  bytes: Uint8Array;
  mimeType: AssetMime;
  purpose: AssetPurpose;
}): Promise<StoredAsset> {
  if (!ALLOWED_MIME.includes(input.mimeType)) {
    throw new AssetError("invalid-mime", "不支持的图片格式");
  }
  if (!(input.bytes instanceof Uint8Array)) {
    throw new AssetError("invalid-bytes", "图片数据无效");
  }
  if (input.bytes.byteLength === 0) {
    throw new AssetError("invalid-bytes", "图片为空");
  }
  if (input.bytes.byteLength > MAX_BYTES) {
    throw new AssetError("too-large", "图片超过 10 MiB 限制");
  }
  if (!verifySignature(input.mimeType, input.bytes)) {
    throw new AssetError("invalid-signature", "图片签名与声明 MIME 不一致");
  }
  await ensureAssetRoot();
  const id = randomUUID();
  const ext = MIME_TO_EXT[input.mimeType];
  const filePath = path.join(dataRoot(), `${id}.${ext}`);
  await fs.writeFile(filePath, input.bytes);
  return {
    id,
    mimeType: input.mimeType,
    byteLength: input.bytes.byteLength,
    purpose: input.purpose,
    createdAt: new Date().toISOString(),
  };
}

/**
 * 读取资产字节。可选 signal 用于取消。
 * 不允许通过此函数读取 .env.local 或其它非资产文件。
 */
export async function readAssetBytes(
  assetId: string,
  signal?: AbortSignal
): Promise<{ bytes: Uint8Array; mimeType: AssetMime; path: string }> {
  if (!isAssetId(assetId)) {
    throw new AssetError("invalid-id", "资产 ID 格式无效");
  }
  if (signal?.aborted) {
    throw new AssetError("cancelled", "请求已取消");
  }
  await ensureAssetRoot();
  const root = dataRoot();
  let foundPath: string | null = null;
  let foundMime: AssetMime | null = null;
  for (const m of ALLOWED_MIME) {
    const p = path.join(root, `${assetId}.${MIME_TO_EXT[m]}`);
    try {
      const stat = await fs.stat(p);
      if (stat.isFile()) {
        foundPath = p;
        foundMime = m;
        break;
      }
    } catch {
      // continue
    }
  }
  if (!foundPath || !foundMime) {
    throw new AssetError("not-found", "资产不存在", 404);
  }
  const bytes = await fs.readFile(foundPath);
  return { bytes, mimeType: foundMime, path: foundPath };
}

/**
 * 读取并转换为可发送到上游 provider 的 base64 data URL。
 * 任何业务路由需要给模型发图时只能调用此函数。
 */
export async function readAssetForProvider(
  assetId: string,
  signal?: AbortSignal
): Promise<string> {
  const { bytes, mimeType } = await readAssetBytes(assetId, signal);
  // 在 Node 中 base64 编码：使用 Buffer 避免超大字符串拼接造成 GC 压力
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

/**
 * 删除单个资产。
 * 命中即返回 true；资产不存在或扩展名都不匹配返回 false。
 */
export async function deleteAsset(assetId: string): Promise<boolean> {
  if (!isAssetId(assetId)) {
    throw new AssetError("invalid-id", "资产 ID 格式无效");
  }
  await ensureAssetRoot();
  const root = dataRoot();
  let removed = false;
  for (const m of ALLOWED_MIME) {
    const p = path.join(root, `${assetId}.${MIME_TO_EXT[m]}`);
    try {
      await fs.unlink(p);
      removed = true;
    } catch {
      // 不存在就尝试下一个
    }
  }
  return removed;
}

/**
 * 文件签名校验：PNG/JPEG/WebP 头若干字节。
 */
function verifySignature(mime: AssetMime, bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) return false;
  const head = bytes;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mime === "image/png") {
    return (
      head[0] === 0x89 &&
      head[1] === 0x50 &&
      head[2] === 0x4e &&
      head[3] === 0x47 &&
      head[4] === 0x0d &&
      head[5] === 0x0a &&
      head[6] === 0x1a &&
      head[7] === 0x0a
    );
  }
  // JPEG: FF D8 FF
  if (mime === "image/jpeg") {
    return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  }
  // WebP: 前 4 字节 RIFF，8-11 字节 WEBP
  if (mime === "image/webp") {
    return (
      head[0] === 0x52 &&
      head[1] === 0x49 &&
      head[2] === 0x46 &&
      head[3] === 0x46 &&
      head[8] === 0x57 &&
      head[9] === 0x45 &&
      head[10] === 0x42 &&
      head[11] === 0x50
    );
  }
  return false;
}

export class AssetError extends Error {
  code: string;
  httpStatus: number;
  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}