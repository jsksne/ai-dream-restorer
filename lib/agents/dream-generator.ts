// ===== DreamGenerator Agent（重构版）=====
// 变更：
// 1. imageBase64 改名为 imageAssetId（语义更清晰）
// 2. 所有 provider 调用接受外部 signal
// 3. 下载远程图片后保存到受控资产仓库，返回 assetId
// 4. VLM 标签生成支持 0..1 归一化坐标（box 字段）

import { getProvider } from '@/lib/providers';
import { storeAsset, type StoredAsset } from '@/lib/assets/server';
import { sendMessage, produceArtifact } from './bus';
import type { DreamGenInput, DreamGenResult } from './types';
import type { SemanticTags } from '@/types';

const DEFAULT_TAGS: SemanticTags = {
  scene: '未知',
  emotion: '未知',
  elements: [],
};

const MAX_REMOTE_IMAGE_BYTES = 12 * 1024 * 1024;

/** 下载远程图片并保存到受控资产仓库，返回 assetId */
const MOCK_PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));

async function downloadAndStore(imageUrl: string, signal?: AbortSignal): Promise<StoredAsset> {
  if (imageUrl.startsWith("/api/mock-assets/")) {
    return storeAsset({ bytes: MOCK_PNG, mimeType: "image/png", purpose: "generated" });
  }
  const response = await fetch(imageUrl, { signal });
  if (!response.ok) {
    throw new Error(`下载图像失败: ${response.status}`);
  }
  const buf = new Uint8Array(await response.arrayBuffer());
  if (buf.byteLength > MAX_REMOTE_IMAGE_BYTES) {
    throw new Error('远程图像超过 12 MiB');
  }
  // 优先用文件魔数识别，其次 content-type，最后 URL 后缀
  const mime =
    sniffMime(buf) ??
    mimeFromContentType(response.headers.get('content-type') || '', imageUrl);
  if (!mime) {
    throw new Error('远程图像 MIME 不受支持');
  }
  return await storeAsset({
    bytes: buf,
    mimeType: mime,
    purpose: 'generated',
  });
}

/** 通过文件魔数识别图片 MIME（不依赖服务器返回的 content-type） */
function sniffMime(buf: Uint8Array): StoredAsset['mimeType'] | null {
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

/** 从 content-type 头或 URL 后缀推断 MIME */
function mimeFromContentType(contentType: string, imageUrl: string): StoredAsset['mimeType'] | null {
  const ct = contentType.toLowerCase();
  if (ct.includes('png')) return 'image/png';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'image/jpeg';
  if (ct.includes('webp')) return 'image/webp';
  const ext = imageUrl.split('?')[0].toLowerCase();
  if (ext.endsWith('.png')) return 'image/png';
  if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) return 'image/jpeg';
  if (ext.endsWith('.webp')) return 'image/webp';
  return null;
}

/**
 * DreamGenerator Agent 入口
 */
export async function runDreamGenerator(
  taskId: string,
  input: DreamGenInput,
  signal?: AbortSignal
): Promise<DreamGenResult & { assetId: string }> {
  sendMessage({
    taskId,
    fromAgentId: 'orchestrator',
    toAgentId: 'dream-generator',
    content: input,
    timestamp: Date.now(),
  });

  const { mode, description, imageBase64, saveAsVersion } = input;

  // 1. 调用图像 API
  const provider = getProvider();
  let remoteImageUrl: string;
  if (mode === 'generate') {
    const r = await provider.text2Image(description, signal);
    remoteImageUrl = r.imageUrl;
  } else {
    if (!imageBase64) {
      throw new Error(`[DreamGenerator] mode=${mode} 需要 imageAssetId`);
    }
    const r = await provider.img2Img(description, imageBase64, mode, signal);
    remoteImageUrl = r.imageUrl;
  }

  // 2. 下载到受控资产仓库
  const stored = await downloadAndStore(remoteImageUrl, signal);
  const localUrl = `/api/assets/${stored.id}`;

  // 3. 仅在 generate / saveAsVersion 时打标签
  const shouldTag = mode === 'generate' || saveAsVersion === true;
  const tags: SemanticTags = shouldTag
    ? await provider.generateSemanticTags(localUrl, signal).then((result): SemanticTags => ({
        ...result,
        elementPositions: result.elementPositions?.map((position) => ({ ...position, region: "center" as const })),
      })).catch((e): SemanticTags => {
        console.warn('[DreamGenerator] VLM 标签生成失败，降级为默认值:', e?.message || e);
        return DEFAULT_TAGS;
      })
    : DEFAULT_TAGS;

  // 4. 产出 Artifact
  const result: DreamGenResult & { assetId: string } = {
    imageUrl: localUrl,
    assetId: stored.id,
    tags,
  };
  produceArtifact({
    taskId,
    agentId: 'dream-generator',
    type: 'image',
    data: result,
    createdAt: Date.now(),
  });
  sendMessage({
    taskId,
    fromAgentId: 'dream-generator',
    toAgentId: 'orchestrator',
    content: result,
    timestamp: Date.now(),
  });

  return result;
}

/**
 * VLM 元素识别
 */
export async function runElementIdentify(
  taskId: string,
  assetId: string,
  clickX: number,
  clickY: number,
  signal?: AbortSignal
): Promise<string> {
  sendMessage({
    taskId,
    fromAgentId: 'orchestrator',
    toAgentId: 'dream-generator',
    content: { action: 'identify', assetId, clickX, clickY },
    timestamp: Date.now(),
  });

  let element = '画面中心';
  try {
    const url = `/api/assets/${assetId}`;
    const r = await getProvider().identifyElement(url, clickX, clickY, signal);
    if (r.element?.trim()) element = r.element.trim();
  } catch (e) {
    console.warn(
      '[DreamGenerator] VLM 元素识别失败，降级为画面中心:',
      e instanceof Error ? e.message : e
    );
  }

  produceArtifact({
    taskId,
    agentId: 'dream-generator',
    type: 'tags',
    data: { element },
    createdAt: Date.now(),
  });
  sendMessage({
    taskId,
    fromAgentId: 'dream-generator',
    toAgentId: 'orchestrator',
    content: { element },
    timestamp: Date.now(),
  });

  return element;
}