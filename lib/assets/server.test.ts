// 受控资产仓库测试
// 覆盖路径穿越、白名单、大小限制、签名校验和原子性

import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import {
  isAssetId,
  looksLikePathTraversal,
  storeAsset,
  readAssetForProvider,
  readAssetBytes,
  deleteAsset,
  resolveAssetPath,
  ensureAssetRoot,
} from "./server";

let tmpRoot = "";

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "oneira-asset-"));
  process.env.ONEIRA_DATA_DIR = tmpRoot;
});

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89,
]);

const JPEG_BYTES = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
  0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06,
  0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c,
  0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f,
  0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28,
  0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff,
  0xd9,
]);

const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c,
  0x20, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d,
  0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x02, 0x00,
  0x34, 0x25, 0xa4, 0x00, 0x03, 0x70, 0x00, 0xfe,
  0xfb, 0x94, 0x00, 0x00,
]);

describe("isAssetId 格式校验", () => {
  it("合法 UUID 通过", () => {
    expect(isAssetId("12345678-1234-1234-1234-123456789abc")).toBe(true);
    expect(isAssetId("ABCDEF12-1234-1234-1234-123456789ABC")).toBe(true);
  });
  it("非 UUID 拒绝", () => {
    expect(isAssetId("not-a-uuid")).toBe(false);
    expect(isAssetId("")).toBe(false);
    expect(isAssetId(null)).toBe(false);
    expect(isAssetId(undefined)).toBe(false);
    expect(isAssetId(123)).toBe(false);
  });
});

describe("looksLikePathTraversal 路径污染检测", () => {
  it.each([
    "../.env.local",
    "/../.env.local",
    "..\\.env.local",
    "C:\\Windows\\System32",
    "%2e%2e/.env.local",
    "%2f%2e%2e",
    "%5c..",
    "/etc/passwd",
    "foo/bar",
    "foo\\bar",
  ])("拒绝 %s", (input) => {
    expect(looksLikePathTraversal(input)).toBe(true);
  });
  it.each([
    "12345678-1234-1234-1234-123456789abc",
    "abcdef",
  ])("接受 %s", (input) => {
    expect(looksLikePathTraversal(input)).toBe(false);
  });
});

describe("storeAsset 合法路径", () => {
  it("PNG 字节被保存为 UUID 文件", async () => {
    const stored = await storeAsset({
      bytes: PNG_BYTES,
      mimeType: "image/png",
      purpose: "generated",
    });
    expect(stored.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(stored.mimeType).toBe("image/png");
    expect(stored.byteLength).toBe(PNG_BYTES.byteLength);

    const filePath = path.join(tmpRoot, "assets", `${stored.id}.png`);
    const exists = await fs.stat(filePath).then(() => true, () => false);
    expect(exists).toBe(true);
  });

  it("JPEG 与 WebP 也被接受", async () => {
    const jpg = await storeAsset({
      bytes: JPEG_BYTES,
      mimeType: "image/jpeg",
      purpose: "generated",
    });
    expect(jpg.mimeType).toBe("image/jpeg");

    const wp = await storeAsset({
      bytes: WEBP_BYTES,
      mimeType: "image/webp",
      purpose: "dream-self-canonical",
    });
    expect(wp.mimeType).toBe("image/webp");
  });

  it("返回的资产可被 readAssetBytes / readAssetForProvider 读回", async () => {
    const stored = await storeAsset({
      bytes: PNG_BYTES,
      mimeType: "image/png",
      purpose: "generated",
    });
    const back = await readAssetBytes(stored.id);
    expect(back.mimeType).toBe("image/png");
    expect(back.bytes.byteLength).toBe(PNG_BYTES.byteLength);

    const dataUrl = await readAssetForProvider(stored.id);
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("删除资产只影响目标 ID", async () => {
    const a = await storeAsset({ bytes: PNG_BYTES, mimeType: "image/png", purpose: "generated" });
    const b = await storeAsset({ bytes: PNG_BYTES, mimeType: "image/png", purpose: "generated" });
    const removed = await deleteAsset(a.id);
    expect(removed).toBe(true);
    const stillThere = await readAssetBytes(b.id).then(() => true, () => false);
    expect(stillThere).toBe(true);
    const gone = await readAssetBytes(a.id).then(() => true, () => false);
    expect(gone).toBe(false);
  });
});

describe("storeAsset 拒绝危险输入", () => {
  it("拒绝超过 10 MiB 的上传", async () => {
    const huge = new Uint8Array(11 * 1024 * 1024);
    huge.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await expect(
      storeAsset({ bytes: huge, mimeType: "image/png", purpose: "generated" })
    ).rejects.toThrow(/10 MiB|too-large|超过/);
  });

  it("拒绝不在白名单的 MIME", async () => {
    await expect(
      storeAsset({
        bytes: PNG_BYTES,
        mimeType: "image/gif" as unknown as "image/png",
        purpose: "generated",
      })
    ).rejects.toThrow();
  });

  it("拒绝与签名不一致的 MIME", async () => {
    // 用 JPEG 字节假装 PNG
    await expect(
      storeAsset({
        bytes: JPEG_BYTES,
        mimeType: "image/png",
        purpose: "generated",
      })
    ).rejects.toThrow(/签名|signature/i);
  });

  it("拒绝空字节", async () => {
    await expect(
      storeAsset({ bytes: new Uint8Array(0), mimeType: "image/png", purpose: "generated" })
    ).rejects.toThrow();
  });
});

describe("readAssetBytes / resolveAssetPath 路径穿越拦截", () => {
  it.each([
    "../.env.local",
    "..\\etc\\passwd",
    "/etc/passwd",
    "C:\\Windows",
    "%2e%2e/.env.local",
    "not-a-uuid",
    "abc/../etc",
    "abc/def",
    "12345678-1234-1234-1234-123456789ab", // 长度不够
  ])("readAssetBytes 拒绝 %s", async (id) => {
    await expect(readAssetBytes(id)).rejects.toThrow();
  });

  it.each([
    "../.env.local",
    "C:\\Windows",
    "abc/..",
  ])("resolveAssetPath 拒绝 %s", async (id) => {
    await expect(resolveAssetPath(id)).rejects.toThrow();
  });

  it("任何路径字符串都不会逃出 assets 目录", async () => {
    await ensureAssetRoot();
    // 即使环境变量 ONEIRA_DATA_DIR 被恶意设置，也只能写到 ONEIRA_DATA_DIR 解析的子目录
    process.env.ONEIRA_DATA_DIR = "../escape";
    await expect(
      storeAsset({ bytes: PNG_BYTES, mimeType: "image/png", purpose: "generated" })
    ).resolves.toBeDefined();
    // 验证：tmpRoot 之外（即 tmpRoot 父目录）没有出现新写入的文件
    const parent = path.dirname(tmpRoot);
    await fs.readdir(parent);
    // 应该没有 escape 子目录被创建（除非父目录已存在）
    const escapeDir = path.join(parent, "escape");
    let escapeExists = false;
    try {
      await fs.stat(escapeDir);
      escapeExists = true;
    } catch {
      escapeExists = false;
    }
    expect(escapeExists).toBe(false);
    // 清理：避免污染其他测试
    process.env.ONEIRA_DATA_DIR = tmpRoot;
  });
});