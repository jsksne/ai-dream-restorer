import { describe, expect, it, beforeEach } from "vitest";
import {
  loadKnowledgeBase,
  retrieveRelevantTheories,
  formatRagContext,
  type RagEntry,
} from "./dream-rag";

describe("dream-rag 释梦知识库检索", () => {
  let kb: RagEntry[];

  beforeEach(() => {
    // 加载真实知识库（data/dream_theory/*.json）
    kb = loadKnowledgeBase();
  });

  describe("loadKnowledgeBase", () => {
    it("应当加载到非空的知识库条目", () => {
      expect(kb.length).toBeGreaterThan(0);
    });

    it("每条目应包含 id / source / title / content / keywords 字段且非空", () => {
      for (const entry of kb) {
        expect(entry.id).toBeTruthy();
        expect(entry.source).toBeTruthy();
        expect(entry.title).toBeTruthy();
        expect(entry.content).toBeTruthy();
        expect(Array.isArray(entry.keywords)).toBe(true);
        expect(entry.keywords.length).toBeGreaterThan(0);
      }
    });

    it("应当包含弗洛伊德与荣格理论条目", () => {
      const sources = kb.map((e) => e.source);
      expect(sources.some((s) => s.includes("弗洛伊德"))).toBe(true);
      expect(sources.some((s) => s.includes("荣格"))).toBe(true);
    });

    it("应当包含常见梦境意象条目", () => {
      const hasSymbol = kb.some((e) =>
        e.title.includes("水") ||
        e.title.includes("飞翔") ||
        e.title.includes("坠落")
      );
      expect(hasSymbol).toBe(true);
    });
  });

  describe("retrieveRelevantTheories", () => {
    it("对水相关描述应返回与水相关的条目", () => {
      const results = retrieveRelevantTheories("我梦见在大海里游泳，浪很大", kb, 3);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(3);
      // 至少有一个结果的 keywords 包含水相关词
      const hasWaterMatch = results.some((r) =>
        r.keywords.some((k) => ["水", "海", "浪", "游泳"].includes(k))
      );
      expect(hasWaterMatch).toBe(true);
    });

    it("对飞翔描述应返回飞翔相关条目", () => {
      const results = retrieveRelevantTheories("梦见自己在天空飞翔，自由自在", kb, 3);
      expect(results.length).toBeGreaterThan(0);
      const hasFlyMatch = results.some((r) =>
        r.keywords.some((k) => ["飞", "飞翔", "天空", "翱翔"].includes(k))
      );
      expect(hasFlyMatch).toBe(true);
    });

    it("对坠落描述应返回坠落相关条目", () => {
      const results = retrieveRelevantTheories("梦见从高处坠落，很害怕", kb, 3);
      expect(results.length).toBeGreaterThan(0);
      const hasFallMatch = results.some((r) =>
        r.keywords.some((k) => ["坠落", "掉", "下落", "跌"].includes(k))
      );
      expect(hasFallMatch).toBe(true);
    });

    it("对被追逐描述应返回追逐相关条目", () => {
      const results = retrieveRelevantTheories("梦见被黑影追赶，一直逃跑", kb, 3);
      expect(results.length).toBeGreaterThan(0);
      const hasChaseMatch = results.some((r) =>
        r.keywords.some((k) => ["追", "赶", "逃跑", "追逐", "追赶", "逃避"].includes(k))
      );
      expect(hasChaseMatch).toBe(true);
    });

    it("对无明显意象的描述应仍返回相关度最高的条目（不抛错）", () => {
      const results = retrieveRelevantTheories("做了一个奇怪的梦", kb, 3);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it("limit 参数应限制返回数量", () => {
      const results = retrieveRelevantTheories("梦见海浪和天空", kb, 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("返回结果应按相关度得分降序排序", () => {
      const results = retrieveRelevantTheories("梦见海", kb, 5);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it("空查询应返回空数组（不抛错）", () => {
      const results = retrieveRelevantTheories("", kb, 3);
      expect(results).toEqual([]);
    });
  });

  describe("formatRagContext", () => {
    it("应将检索结果格式化为文本片段供 LLM 使用", () => {
      const results = retrieveRelevantTheories("梦见大海", kb, 2);
      const formatted = formatRagContext(results);
      expect(typeof formatted).toBe("string");
      expect(formatted.length).toBeGreaterThan(0);
      // 应包含每条的 title 与 content
      for (const r of results) {
        expect(formatted).toContain(r.title);
      }
    });

    it("空数组应返回空字符串", () => {
      const formatted = formatRagContext([]);
      expect(formatted).toBe("");
    });
  });
});
