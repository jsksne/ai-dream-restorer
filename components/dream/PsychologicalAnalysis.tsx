"use client";

// ===== Oneira 心理分析组件（v2 重构版）=====
// 四段非诊断性内容：
//   - 梦境线索（dreamClues）
//   - 情绪脉络（emotionalThread）
//   - 可能的现实联想（possibleConnections）
//   - 可供思考的问题（reflectionQuestions）
// 视觉证据 + 探索轨迹独立展示
// 无睡眠推断、无诊断措辞

import { useEffect, useState, useCallback, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAgentStream } from "@/hooks/useAgentStream";
import type { SemanticTags } from "@/types";
import type { DreamNode, AnalysisArtifact } from "@/lib/project-storage";

interface PsychologicalAnalysisProps {
  targetNode: DreamNode;
  exploreTendency?: string[];
  onClose: () => void;
  analyze: (
    assetId: string,
    description: string,
    tags: { scene: string; emotion: string; elements: string[] },
    explorationTendency?: string[]
  ) => Promise<{ exploreNote: string | null; disclaimer: string } | void>;
  artifact: AnalysisArtifact | null;
  autoRun?: boolean;
}

type AnalysisStatus = "idle" | "analyzing" | "done" | "error";

const DIMENSION_KEYS = ["dreamClues", "emotionalThread", "possibleConnections", "reflectionQuestions"] as const;
type DimensionKey = (typeof DIMENSION_KEYS)[number];

const DIMENSION_META: Record<DimensionKey, { title: string; subtitle: string }> = {
  dreamClues: { title: "梦境线索", subtitle: "画面与文本的可观察线索" },
  emotionalThread: { title: "情绪脉络", subtitle: "开放、非诊断性的情绪观察" },
  possibleConnections: { title: "可能联想", subtitle: "与生活的开放参考" },
  reflectionQuestions: { title: "可思考问题", subtitle: "供自我探索" },
};

export function PsychologicalAnalysis({
  targetNode,
  exploreTendency,
  onClose,
  analyze,
  artifact,
  autoRun = true,
}: PsychologicalAnalysisProps) {
  const { showToast } = useToast();
  const deltaBuffer = useAgentStream((s) => s.deltaBuffer);
  const sseStatus = useAgentStream((s) => s.status);
  const sseError = useAgentStream((s) => s.error);

  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const startedRef = useRef(false);

  const runAnalysis = useCallback(async () => {
    setStatus("analyzing");
    setErrorMsg(null);
    startedRef.current = true;
    try {
      const result = await analyze(
        targetNode.assetId,
        targetNode.prompt,
        {
          scene: targetNode.branchLabel,
          emotion: "未知",
          elements: targetNode.sceneRegions.map((r) => r.label),
        },
        exploreTendency && exploreTendency.length > 0 ? exploreTendency : undefined
      );
      if (!result) {
        setStatus("error");
        return;
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "分析失败");
      setStatus("error");
    }
  }, [targetNode, exploreTendency, analyze]);

  useEffect(() => {
    if (!autoRun || startedRef.current || artifact) return;
    void runAnalysis();
  }, [autoRun, artifact, runAnalysis]);

  useEffect(() => {
    if (sseStatus === "completed") setStatus("done");
    else if (sseStatus === "failed") {
      setErrorMsg(sseError || "分析失败");
      setStatus("error");
    }
  }, [sseStatus, sseError]);

  const handleRerun = useCallback(() => {
    if (status === "analyzing") return;
    startedRef.current = false;
    showToast("正在重新生成分析…", "info");
    void runAnalysis();
  }, [status, runAnalysis, showToast]);

  return (
    <Modal
      open
      onClose={onClose}
      title="读读这个梦"
      maxWidth="max-w-2xl"
      footer={
        <>
          <div className="text-[10px] text-[color:var(--foreground-subtle)] mr-auto">
            {artifact && (
              <span>
                {artifact.mode === "multimodal" ? "多模态分析" : "文字分析模式"} ·{" "}
                {artifact.visualEvidence.length} 条可观察证据
              </span>
            )}
            {status === "analyzing" && <span>正在分析…</span>}
            {status === "done" && <span>分析完成</span>}
            {status === "error" && <span className="text-[color:var(--error)]">分析失败</span>}
          </div>
          <button
            type="button"
            onClick={handleRerun}
            disabled={status === "analyzing"}
            className="text-xs px-3 py-1.5 rounded-md border border-[color:var(--lavender)] text-[color:var(--lavender-bright)] bg-[color:var(--lavender-soft)] hover:bg-[color:var(--lavender)] hover:text-[color:var(--background)] transition-colors disabled:opacity-40"
          >
            重新分析
          </button>
        </>
      }
    >
      <div className="flex gap-3 items-center mb-4 pb-3 border-b border-[color:var(--border)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/assets/${targetNode.assetId}`}
          alt="分析目标画面"
          className="w-14 h-14 rounded-md object-cover border border-[color:var(--border)] shrink-0"
          draggable={false}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] tracking-widest text-[color:var(--foreground-subtle)] mb-0.5">
            分析对象
          </p>
          <p
            className="text-sm text-[color:var(--foreground)] line-clamp-2 leading-relaxed"
            title={targetNode.prompt}
          >
            {targetNode.prompt}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-lg border border-[color:var(--error)] bg-[color:var(--error-soft)] px-3 py-2 mb-3"
        >
          <p className="text-xs text-[color:var(--error)]">{errorMsg}</p>
        </div>
      )}

      {/* 视觉证据 */}
      {artifact && artifact.visualEvidence.length > 0 && (
        <details className="mb-3">
          <summary className="text-xs text-[color:var(--foreground-subtle)] cursor-pointer">
            视觉证据（{artifact.visualEvidence.length} 条）
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-[color:var(--foreground-muted)] list-disc list-inside">
            {artifact.visualEvidence.map((e, i) => (
              <li key={i}>
                {e.observation}（置信度 {e.confidence.toFixed(2)}）
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* 四段内容 */}
      <div className="flex flex-col gap-3">
        {DIMENSION_KEYS.map((key) => {
          const meta = DIMENSION_META[key];
          const streamed = deltaBuffer[key] ?? "";
          const persisted = artifact
            ? key === "dreamClues"
              ? artifact.dreamClues
              : key === "emotionalThread"
                ? artifact.emotionalThread
                : key === "possibleConnections"
                  ? artifact.possibleConnections
                  : (artifact.reflectionQuestions ?? []).join("\n")
            : "";
          const content = streamed || persisted;
          return (
            <article
              key={key}
              className="rounded-lg border border-[color:var(--border)] px-3 py-2.5"
            >
              <header className="flex items-baseline justify-between mb-1.5">
                <h3 className="text-sm font-medium text-[color:var(--lavender-bright)]">
                  {meta.title}
                </h3>
                <span className="text-[10px] text-[color:var(--foreground-subtle)]">
                  {meta.subtitle}
                </span>
              </header>
              <p className="text-xs text-[color:var(--foreground)] leading-relaxed whitespace-pre-wrap">
                {content || (status === "analyzing" ? "等待中…" : "暂无内容")}
              </p>
            </article>
          );
        })}
      </div>

      {/* 探索轨迹（独立区域，confidence=low） */}
      {artifact && artifact.explorationTrace.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-[color:var(--foreground-subtle)] cursor-pointer">
            你的探索轨迹（低置信度参考）
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-[color:var(--foreground-muted)] list-disc list-inside">
            {artifact.explorationTrace.map((t) => (
              <li key={t.nodeId}>
                {t.summary}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* 免责声明 */}
      {artifact?.disclaimer && (
        <p className="text-[10px] text-[color:var(--foreground-subtle)] mt-4 leading-relaxed">
          {artifact.disclaimer}
        </p>
      )}
    </Modal>
  );
}

export type { SemanticTags };