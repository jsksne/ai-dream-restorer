// ===== Oneira 演示容灾模块（服务端） =====
// 当真实 API 失败（超时/4xx/5xx/离线）时，返回预置的演示数据
// 确保"生成→探索→存为新版本→分析"完整流程可在离线场景下走通
//
// 数据源：data/demo/manifest.json + data/demo/analysis.json
// 调用方式：服务端 API 路由直接 import；前端通过 /api/demo 路由获取

import path from 'path';
import { readFileSync } from 'fs';
import type { SemanticTags } from '@/types';

// ===== 类型定义 =====

export interface DemoImage {
  url: string;
  prompt: string;
  semanticTags?: SemanticTags;
  element?: string;
  parentVersion?: string;
  parentExplore?: string;
}

export interface DemoManifest {
  version: string;
  description: string;
  generatedAt: string;
  images: Record<string, DemoImage>;
  explorePath: {
    baseVersionId: string;
    nodes: Array<{
      id: string;
      element: string;
      explorePrompt: string;
      imageUrl: string;
    }>;
  };
  /** 元素点击映射：当前画面 ID → { 元素名 → 下一张探索图 ID } */
  elementClickMap: Record<string, Record<string, string>>;
}

export interface DemoAnalysisDimension {
  title: string;
  subtitle: string;
  content: string;
}

export interface DemoAnalysis {
  version: string;
  generatedAt: string;
  description: string;
  targetImage: string;
  targetDescription: string;
  dimensions: Record<string, DemoAnalysisDimension>;
  exploreNote: string;
  disclaimer: string;
}

// ===== 缓存 =====

let cachedManifest: DemoManifest | null = null;
let cachedAnalysis: DemoAnalysis | null = null;

function getDemoDir(): string {
  return path.join(process.cwd(), 'data', 'demo');
}

/**
 * 加载演示 manifest（服务端同步读取）
 * 文件缺失时返回 null（不抛错，调用方决定降级策略）
 */
export function loadDemoManifest(): DemoManifest | null {
  if (cachedManifest) return cachedManifest;
  try {
    const fullPath = path.join(getDemoDir(), 'manifest.json');
    const raw = readFileSync(fullPath, 'utf-8');
    cachedManifest = JSON.parse(raw) as DemoManifest;
    return cachedManifest;
  } catch (e) {
    console.warn('[DemoFallback] manifest.json 加载失败:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * 加载演示心理分析 JSON
 * 文件缺失时返回 null
 */
export function loadDemoAnalysis(): DemoAnalysis | null {
  if (cachedAnalysis) return cachedAnalysis;
  try {
    const fullPath = path.join(getDemoDir(), 'analysis.json');
    const raw = readFileSync(fullPath, 'utf-8');
    cachedAnalysis = JSON.parse(raw) as DemoAnalysis;
    return cachedAnalysis;
  } catch (e) {
    console.warn('[DemoFallback] analysis.json 加载失败:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ===== Demo 模拟业务函数（供 API 路由调用） =====

/**
 * 模拟"首次生成"返回：返回首版图 + 语义标签
 * @param _prompt 用户输入的梦境描述（演示模式不使用，保留参数以匹配签名）
 */
export function demoGenerate(_prompt: string): {
  imageUrl: string;
  tags: SemanticTags;
} | null {
  const manifest = loadDemoManifest();
  if (!manifest) return null;

  const v0 = manifest.images['v0_initial'];
  if (!v0 || !v0.semanticTags) return null;

  // 忽略 prompt 内容（demo 模式直接返回预设首版）
  return {
    imageUrl: v0.url,
    tags: v0.semanticTags,
  };
}

/**
 * 模拟"微调"返回：返回微调版图（不打标签，使用空标签结构保持接口一致）
 */
export function demoRefine(): {
  imageUrl: string;
  tags: SemanticTags;
} | null {
  const manifest = loadDemoManifest();
  if (!manifest) return null;

  const v1 = manifest.images['v1_refine'];
  if (!v1 || !v1.semanticTags) return null;

  return {
    imageUrl: v1.url,
    tags: v1.semanticTags,
  };
}

/**
 * 模拟"探索"返回：根据当前画面 ID + 点击元素查找预设的下一张探索图
 * 找不到时返回 null（调用方决定降级）
 *
 * @param currentImageKey 当前画面的 manifest key（如 'v0_initial' / 'e0_from_v0_sea'）
 * @param elementHint VLM 识别或用户点击的元素名
 */
export function demoExplore(
  currentImageKey: string,
  elementHint?: string
): {
  element: string;
  imageUrl: string;
  tags: SemanticTags;
  nextImageKey: string;
} | null {
  const manifest = loadDemoManifest();
  if (!manifest) return null;

  // 1. 优先按元素名查找预设映射
  if (elementHint) {
    const clickMap = manifest.elementClickMap[currentImageKey];
    if (clickMap) {
      // 精确匹配
      let nextId = clickMap[elementHint];
      // 模糊匹配：包含关系
      if (!nextId) {
        for (const [key, id] of Object.entries(clickMap)) {
          if (elementHint.includes(key) || key.includes(elementHint)) {
            nextId = id;
            break;
          }
        }
      }
      if (nextId) {
        const nextImage = manifest.images[nextId];
        if (nextImage) {
          return {
            element: nextImage.element || elementHint,
            imageUrl: nextImage.url,
            tags: {
              scene: '',
              emotion: '',
              elements: [],
            },
            nextImageKey: nextId,
          };
        }
      }
    }
  }

  // 2. 降级：按 explorePath 顺序返回下一张
  const pathNodes = manifest.explorePath.nodes;
  const currentIndex = pathNodes.findIndex((n) => n.id === currentImageKey);
  if (currentIndex >= 0 && currentIndex < pathNodes.length - 1) {
    const nextNode = pathNodes[currentIndex + 1];
    return {
      element: nextNode.element,
      imageUrl: nextNode.imageUrl,
      tags: {
        scene: '',
        emotion: '',
        elements: [],
      },
      nextImageKey: nextNode.id,
    };
  }

  // 3. 默认：从首版进入第一层探索
  if (currentImageKey === 'v0_initial' && pathNodes.length > 0) {
    const firstNode = pathNodes[0];
    return {
      element: firstNode.element,
      imageUrl: firstNode.imageUrl,
      tags: {
        scene: '',
        emotion: '',
        elements: [],
      },
      nextImageKey: firstNode.id,
    };
  }

  return null;
}

/**
 * 根据 imageUrl 反查 manifest key（前端切换 demo 模式时用）
 */
export function findImageKeyByUrl(imageUrl: string): string | null {
  const manifest = loadDemoManifest();
  if (!manifest) return null;
  for (const [key, img] of Object.entries(manifest.images)) {
    if (img.url === imageUrl) return key;
  }
  return null;
}

/**
 * 模拟"心理分析"返回：直接返回完整四维度分析（无流式）
 * 前端拿到后填充到 deltaBuffer 模拟流式效果（在 useAgentStream 层处理）
 */
export function demoAnalyze(): {
  dimensions: Record<string, DemoAnalysisDimension>;
  exploreNote: string;
  disclaimer: string;
} | null {
  const analysis = loadDemoAnalysis();
  if (!analysis) return null;
  return {
    dimensions: analysis.dimensions,
    exploreNote: analysis.exploreNote,
    disclaimer: analysis.disclaimer,
  };
}

/** 仅用于测试：重置缓存 */
export function __resetDemoCacheForTest(): void {
  cachedManifest = null;
  cachedAnalysis = null;
}
