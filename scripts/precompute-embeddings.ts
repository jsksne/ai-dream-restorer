// ===== 离线预计算释梦理论向量脚本 =====
// 用法：npx tsx scripts/precompute-embeddings.ts
//
// 流程：
// 1. 读取 data/dream_theory/*.json 全部条目
// 2. 调 embedTextBatch 批量向量化（每批 ≤ 32 条）
// 3. 写入 data/dream_theory/embeddings.json
//
// 不依赖 Next.js 运行时，可独立通过 tsx 执行。

import path from "node:path";
import { promises as fs } from "node:fs";
import { embedTextBatch, EMBEDDING_MODEL } from "../lib/siliconflow";

const ROOT = process.cwd();
const KB_DIR = path.join(ROOT, "data", "dream_theory");
const OUTPUT_FILE = path.join(KB_DIR, "embeddings.json");

const KB_FILES = ["freud.json", "jung.json", "symbols.json"];
const BATCH_SIZE = 32;

interface TheoryEntry {
  id: string;
  title: string;
  content: string;
  keywords: string[];
}

interface TheoryFile {
  source: string;
  theories: TheoryEntry[];
}

interface SymbolsFile {
  source: string;
  symbols: Array<{
    id: string;
    element: string;
    interpretation: string;
    keywords: string[];
  }>;
}

interface OutputEntry {
  id: string;
  source: string;
  title: string;
  content: string;
  keywords: string[];
  embedding: number[];
}

interface OutputFile {
  model: string;
  generatedAt: string;
  entries: OutputEntry[];
}

async function loadAllEntries(): Promise<Omit<OutputEntry, "embedding">[]> {
  const out: Omit<OutputEntry, "embedding">[] = [];
  for (const file of KB_FILES) {
    const fullPath = path.join(KB_DIR, file);
    try {
      const raw = await fs.readFile(fullPath, "utf-8");
      const data = JSON.parse(raw) as TheoryFile | SymbolsFile;
      const source = data.source || file;
      if ("theories" in data && Array.isArray(data.theories)) {
        for (const t of data.theories) {
          out.push({
            id: t.id,
            source,
            title: t.title,
            content: t.content,
            keywords: Array.isArray(t.keywords) ? t.keywords : [],
          });
        }
      } else if ("symbols" in data && Array.isArray(data.symbols)) {
        for (const s of data.symbols) {
          out.push({
            id: s.id,
            source,
            title: s.element,
            content: s.interpretation,
            keywords: Array.isArray(s.keywords) ? s.keywords : [],
          });
        }
      }
    } catch (e) {
      console.warn(`[precompute] 跳过 ${file}:`, e instanceof Error ? e.message : e);
    }
  }
  return out;
}

async function computeEmbeddings(
  entries: Omit<OutputEntry, "embedding">[]
): Promise<OutputEntry[]> {
  const result: OutputEntry[] = [];
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    // 把 title + content + keywords 拼成单条文本以提升检索召回
    const texts = batch.map(
      (e) => `${e.title}。${e.content}。关键词：${e.keywords.join("、")}`
    );
    console.log(
      `[precompute] 正在向量化批次 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(entries.length / BATCH_SIZE)}（${batch.length} 条）`
    );
    const vectors = await embedTextBatch(texts);
    if (vectors.length !== batch.length) {
      throw new Error(
        `[precompute] 批量向量返回数量异常：期望 ${batch.length}，实际 ${vectors.length}`
      );
    }
    for (let j = 0; j < batch.length; j++) {
      result.push({ ...batch[j], embedding: vectors[j] });
    }
  }
  return result;
}

async function main() {
  console.log("[precompute] 开始预计算释梦理论向量...");
  console.log(`[precompute] 知识库目录: ${KB_DIR}`);
  console.log(`[precompute] 模型: ${EMBEDDING_MODEL}`);

  const entries = await loadAllEntries();
  if (entries.length === 0) {
    console.error("[precompute] 未加载到任何知识库条目，终止");
    process.exit(1);
  }
  console.log(`[precompute] 共加载 ${entries.length} 条知识库条目`);

  const withEmbeddings = await computeEmbeddings(entries);

  const output: OutputFile = {
    model: EMBEDDING_MODEL,
    generatedAt: new Date().toISOString(),
    entries: withEmbeddings,
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf-8");
  console.log(`[precompute] 已写入 ${OUTPUT_FILE}`);
  console.log(`[precompute] 完成，共 ${withEmbeddings.length} 条向量`);
}

main().catch((e) => {
  console.error("[precompute] 失败:", e);
  process.exit(1);
});
