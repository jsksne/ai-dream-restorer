// ===== Oneira 释梦 RAG 知识库检索 =====
// 两套检索实现并存：
// 1. retrieveRelevantTheories（同步）：基于关键词命中数 + 标题/正文字面匹配，离线可用
// 2. searchDreamTheory（异步）：基于向量检索（BAAI/bge-m3 embedding + 余弦相似度）
//
// 扩展档原则：保留旧实现不动，新增 searchDreamTheory 作为向量检索入口。
// searchDreamTheory 在以下情况自动降级为 retrieveRelevantTheories：
// - embeddings.json 文件缺失（precompute 脚本未运行）
// - SILICONFLOW_API_KEY 未配置 / embedText 调用失败

import path from "path";
import { readFileSync } from "fs";
import { embedText } from "@/lib/siliconflow";

// Turbopack 下 __dirname 行为异常，改用 process.cwd() + 相对路径
// process.cwd() 在 Next.js 服务端运行时始终指向项目根目录
function getKnowledgeDir(): string {
  return path.join(process.cwd(), "data", "dream_theory");
}

/** RAG 条目结构（融合弗洛伊德/荣格理论条目与常见意象条目） */
export interface RagEntry {
  id: string;
  source: string;        // 来源标识（如 "弗洛伊德《梦的解析》核心理论摘要"）
  title: string;         // 条目标题（理论标题或意象元素名）
  content: string;       // 条目正文
  keywords: string[];    // 关键词列表（用于检索匹配）
  score: number;         // 检索相关度得分（检索后填充，原始条目为 0）
}

/** 弗洛伊德/荣格 JSON 文件中的理论条目结构 */
interface TheoryEntry {
  id: string;
  title: string;
  content: string;
  keywords: string[];
}

/** 弗洛伊德/荣格 JSON 文件结构 */
interface TheoryFile {
  source: string;
  theories: TheoryEntry[];
}

/** 常见意象 JSON 文件结构 */
interface SymbolsFile {
  source: string;
  symbols: Array<{
    id: string;
    element: string;
    interpretation: string;
    keywords: string[];
  }>;
}

/** 缓存已加载的知识库，避免重复 IO */
let cachedKb: RagEntry[] | null = null;

/**
 * 加载释梦知识库
 * 读取 data/dream_theory/ 下所有 JSON 文件，统一转换为 RagEntry 数组
 * 文件不存在或解析失败时返回空数组（不抛错，保证心理分析流程可用）
 */
export function loadKnowledgeBase(): RagEntry[] {
  if (cachedKb) return cachedKb;

  // 同步路径下的文件清单（已知三个文件，避免动态 glob 带来的额外依赖）
  const files = ["freud.json", "jung.json", "symbols.json"];
  const entries: RagEntry[] = [];

  for (const file of files) {
    const fullPath = path.join(getKnowledgeDir(), file);
    try {
      // 使用 readFileSync + JSON.parse（Turbopack/ESM 兼容）
      const raw = readFileSync(fullPath, "utf-8");
      const data = JSON.parse(raw) as TheoryFile | SymbolsFile;
      const source = data.source || file;

      if ("theories" in data && Array.isArray(data.theories)) {
        for (const t of data.theories) {
          entries.push({
            id: t.id,
            source,
            title: t.title,
            content: t.content,
            keywords: Array.isArray(t.keywords) ? t.keywords : [],
            score: 0,
          });
        }
      } else if ("symbols" in data && Array.isArray(data.symbols)) {
        for (const s of data.symbols) {
          entries.push({
            id: s.id,
            source,
            title: s.element,
            content: s.interpretation,
            keywords: Array.isArray(s.keywords) ? s.keywords : [],
            score: 0,
          });
        }
      }
    } catch {
      // 单个文件缺失不应阻塞整个知识库加载
    }
  }

  cachedKb = entries;
  return entries;
}

/**
 * 对单个条目计算相关度得分
 * 得分组成：
 *   - 关键词命中：查询包含该关键词 +3
 *   - 标题命中：查询包含完整标题 +6；标题字符在查询中出现 +0.5/字符（上限 6）
 *   - 正文命中：正文自身含关键词 +0.5/词（上限 4，提升含完整释梦叙述的条目）
 */
function scoreEntry(query: string, entry: RagEntry): number {
  if (!query) return 0;
  let score = 0;

  // 关键词命中（精确包含）
  for (const kw of entry.keywords) {
    if (!kw) continue;
    if (query.includes(kw)) score += 3;
  }

  // 标题命中
  const title = entry.title;
  if (title) {
    if (query.includes(title)) {
      score += 6;
    } else {
      let titleCharScore = 0;
      for (const ch of title) {
        if (query.includes(ch)) titleCharScore += 0.5;
      }
      score += Math.min(titleCharScore, 6);
    }
  }

  // 正文命中（按关键词在正文出现频次近似）
  const content = entry.content;
  if (content) {
    let contentHits = 0;
    for (const kw of entry.keywords) {
      if (!kw) continue;
      if (content.includes(kw)) contentHits += 1;
    }
    score += Math.min(contentHits * 0.5, 4);
  }

  return score;
}

/**
 * 检索与梦境描述最相关的理论条目
 *
 * @param query 梦境描述文本（用户输入或 VLM 标签拼串）
 * @param kb 知识库（默认使用 loadKnowledgeBase()）
 * @param limit 返回条目数上限，默认 3
 * @returns 按相关度降序排列的条目数组（每条 score 字段已填充）
 */
export function retrieveRelevantTheories(
  query: string,
  kb?: RagEntry[],
  limit: number = 3
): RagEntry[] {
  const trimmed = (query || "").trim();
  if (!trimmed) return [];

  const base = kb && kb.length > 0 ? kb : loadKnowledgeBase();
  const scored = base
    .map((entry) => ({ ...entry, score: scoreEntry(trimmed, entry) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, Math.max(0, limit));
}

/**
 * 将检索结果格式化为 LLM 可读的纯文本上下文
 * 输出格式：
 *   [来源] 标题
 *   正文内容
 *
 *   [来源] 标题
 *   正文内容
 *
 * 空数组返回空字符串。
 */
export function formatRagContext(entries: RagEntry[]): string {
  if (!entries || entries.length === 0) return "";
  return entries
    .map((e) => `[${e.source}] ${e.title}\n${e.content}`)
    .join("\n\n");
}

/**
 * 重置缓存（仅用于测试）
 */
export function __resetCacheForTest(): void {
  cachedKb = null;
  cachedEmbeddings = null;
}

// ===== 向量检索实现（扩展档新增，不改旧实现） =====

/** 预计算向量文件中的单条结构 */
interface EmbeddingEntry {
  id: string;
  source: string;
  title: string;
  content: string;
  keywords: string[];
  embedding: number[];
}

/** embeddings.json 文件结构 */
interface EmbeddingsFile {
  model: string;
  generatedAt: string;
  entries: EmbeddingEntry[];
}

/** 缓存预计算向量 */
let cachedEmbeddings: EmbeddingEntry[] | null = null;

/**
 * 加载预计算向量文件
 * 文件不存在时返回 null（不抛错，调用方降级为关键词检索）
 */
function loadEmbeddings(): EmbeddingEntry[] | null {
  if (cachedEmbeddings !== null) return cachedEmbeddings;
  const fullPath = path.join(getKnowledgeDir(), "embeddings.json");
  try {
    const raw = readFileSync(fullPath, "utf-8");
    const data = JSON.parse(raw) as EmbeddingsFile;
    if (!Array.isArray(data.entries)) return null;
    cachedEmbeddings = data.entries.filter(
      (e) => Array.isArray(e.embedding) && e.embedding.length > 0
    );
    return cachedEmbeddings;
  } catch {
    return null;
  }
}

/**
 * 计算两个向量的余弦相似度
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * 向量检索释梦理论（spec 要求的 RAG 入口）
 *
 * 流程：
 * 1. 加载 data/dream_theory/embeddings.json 预计算向量
 * 2. 调用 embedText(query) 计算查询向量
 * 3. 余弦相似度 top-K
 *
 * 降级策略：embeddings.json 缺失或 embedText 失败时，
 *          自动回退到 retrieveRelevantTheories（关键词匹配）
 *
 * @param query 查询文本（通常是用户描述 + VLM 标签拼串）
 * @param topK 返回条目数上限，默认 3
 * @returns 按相似度降序排列的条目数组（含 title / content / score / source）
 */
export async function searchDreamTheory(
  query: string,
  topK: number = 3
): Promise<Array<{ title: string; content: string; score: number; source?: string }>> {
  const trimmed = (query || "").trim();
  if (!trimmed) return [];

  // 1. 加载预计算向量
  const entries = loadEmbeddings();
  if (!entries || entries.length === 0) {
    // 无向量 → 降级为关键词匹配
    return retrieveRelevantTheories(trimmed, undefined, topK).map((e) => ({
      title: e.title,
      content: e.content,
      score: e.score,
      source: e.source,
    }));
  }

  // 2. 调用 embedText 算 query 向量
  let queryVec: number[];
  try {
    queryVec = await embedText(trimmed);
  } catch (e) {
    console.warn(
      "[DreamRAG] embedText 失败，降级为关键词检索:",
      e instanceof Error ? e.message : e
    );
    return retrieveRelevantTheories(trimmed, undefined, topK).map((e) => ({
      title: e.title,
      content: e.content,
      score: e.score,
      source: e.source,
    }));
  }

  if (queryVec.length === 0) {
    return retrieveRelevantTheories(trimmed, undefined, topK).map((e) => ({
      title: e.title,
      content: e.content,
      score: e.score,
      source: e.source,
    }));
  }

  // 3. 余弦相似度 top-K
  const scored = entries
    .map((e) => ({
      title: e.title,
      content: e.content,
      score: cosineSimilarity(queryVec, e.embedding),
      source: e.source,
    }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, Math.max(0, topK));
}
