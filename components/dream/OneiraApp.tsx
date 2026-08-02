"use client";

// ===== Oneira 主应用组件（v2 重构版）=====
// 集成：
// - OperationManager 单任务生命周期
// - IndexedDB 持久化（useSession）
// - 真实阶段进度（StageProgress）
// - 点击识别浮窗（ExplorationPopover）
// - 分支选择（BranchPicker）
// - 多模态心理分析入口

import { useState, useCallback, useEffect } from "react";
import { DreamCanvas, type ElementClickInfo } from "./DreamCanvas";
import { UnifiedInput, type SubmitPayload } from "./UnifiedInput";
import { Onboarding, type OnboardingMode } from "./Onboarding";
import { StageProgress } from "./StageProgress";
import { ExplorationPopover } from "./ExplorationPopover";
import { BranchPicker } from "./BranchPicker";
import { PromptCoach } from "./PromptCoach";
import { PsychologicalAnalysis } from "./PsychologicalAnalysis";
import { VoiceHoldButton } from "./VoiceHoldButton";
import { DreamArchive } from "./DreamArchive";
import { DreamSelfManager } from "./DreamSelfManager";
import { DemoBanner } from "./DemoBanner";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useDreamGeneration } from "@/hooks/useDreamGeneration";
import type { SceneRegion } from "@/types";
import { listProfiles, type DreamNode, type DreamSelfProfile } from "@/lib/project-storage";

export function OneiraApp() {
  const {
    project,
    status,
    error,
    operationStatus,
    operationStage,
    getCurrentImageUrl,
    generateInitial,
    refine,
    explore,
    analyze,
    cancel,
    clearError,
    addVersion,
    markClosest,
    getActive,
    getPathFromRoot,
    getChildCount,
    setActive,
    setAnalysis,
    setDreamSelf,
    setRefinedPrompt,
    removeProject,
    loadById,
  } = useDreamGeneration();

  const { showToast } = useToast();

  // ===== UI state =====
  const [inputValue, setInputValue] = useState("");
  const [refinedPrompt, setLocalRefinedPrompt] = useState("");
  const [showCoach, setShowCoach] = useState(false);
  const [coachRound, setCoachRound] = useState(0);
  const [popover, setPopover] = useState<{
    position: { x: number; y: number };
    element: string | null;
    identifying: boolean;
  } | null>(null);
  const [branchPickerNode, setBranchPickerNode] = useState<DreamNode | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [onboardingForceCount, setOnboardingForceCount] = useState(0);
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisTargetNode, setAnalysisTargetNode] = useState<DreamNode | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [dreamSelfOpen, setDreamSelfOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [activeDreamSelf, setActiveDreamSelf] = useState<DreamSelfProfile | null>(null);

  const isGenerating = status === "generating" || status === "asking";
  const hasNodes = Object.keys(project.nodes).length > 0;
  const activeNode = getActive();
  const currentImageUrl = getCurrentImageUrl();
  const sceneRegions: SceneRegion[] = activeNode?.sceneRegions ?? [];
  const activeChildCount = activeNode ? getChildCount(activeNode.id) : 0;

  useEffect(() => {
    try {
      const stored = localStorage.getItem("oneira-onboarding-mode");
      if (stored === "manual" || stored === "auto") setOnboardingMode(stored);
    } catch {
      // 首次访问时由引导弹窗选择
    }
  }, []);

  useEffect(() => {
    if (!project.activeDreamSelfId) {
      setActiveDreamSelf(null);
      return;
    }
    void listProfiles().then((profiles) => {
      setActiveDreamSelf(profiles.find((profile) => profile.id === project.activeDreamSelfId) ?? null);
    });
  }, [project.activeDreamSelfId]);

  const appendDreamSelf = useCallback((prompt: string) => {
    if (!activeDreamSelf || project.perspective === "observer-without-self") return prompt;
    const traits = activeDreamSelf.signatureTraits.length > 0 ? `；标志性特征：${activeDreamSelf.signatureTraits.join("、")}` : "";
    return `${prompt}\n[梦中身份] ${activeDreamSelf.description || activeDreamSelf.name}${traits}`;
  }, [activeDreamSelf, project.perspective]);

  // 错误 toast
  useEffect(() => {
    if (error) {
      showToast(error, "error");
      clearError();
    }
  }, [error, showToast, clearError]);

  // ===== 点击画面直接探索：弹浮窗 =====
  const handleDirectExplore = useCallback(
    (info: ElementClickInfo) => {
      if (!currentImageUrl || !hasNodes) return;
      if (isGenerating) {
        showToast("正在生成中，请稍候…", "warning");
        return;
      }
      setPopover({
        position: { x: info.x, y: info.y },
        element: null,
        identifying: true,
      });
      // 调用 /api/identify 获取元素
      (async () => {
        try {
          const assetIdMatch = currentImageUrl.match(/\/api\/assets\/([0-9a-f-]{36})/);
          const assetId = assetIdMatch?.[1];
          if (!assetId) {
            setPopover(null);
            return;
          }
          const res = await fetch("/api/identify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskId: `identify-${Date.now()}`,
              assetId,
              clickX: info.x,
              clickY: info.y,
            }),
          });
          if (!res.ok) {
            throw new Error("识别失败");
          }
          const data = (await res.json()) as { element?: string };
          setPopover((p) =>
            p
              ? {
                  ...p,
                  element: data.element || "画面元素",
                  identifying: false,
                }
              : null
          );
        } catch {
          setPopover((p) =>
            p
              ? { ...p, element: "画面元素", identifying: false }
              : null
          );
        }
      })();
    },
    [currentImageUrl, hasNodes, isGenerating, showToast]
  );

  const handleShiftClick = handleDirectExplore; // 同入口

  const handlePopoverConfirm = useCallback(
    (hint: string) => {
      if (!popover || !popover.element || !activeNode) {
        setPopover(null);
        return;
      }
      setPopover(null);
      void explore(popover.element, hint, { x: popover.position.x, y: popover.position.y });
    },
    [popover, activeNode, explore]
  );

  // ===== 输入分发 =====
  const handleSubmit = useCallback(
    async (text: string, payload: SubmitPayload) => {
      if (payload.action === "initial") {
        const initialPrompt = appendDreamSelf(text);
        setLocalRefinedPrompt(initialPrompt);
        if (onboardingMode === "manual") {
          setRefinedPrompt(initialPrompt);
          await generateInitial(initialPrompt, true);
          return;
        }
        setShowCoach(true);
        setCoachRound(0);
        return;
      }
      if (payload.action === "refine") {
        await refine(text);
        setInputValue("");
        return;
      }
      if (payload.action === "auto-explore" || payload.action === "guided-explore") {
        if (!payload.element) {
          showToast("请先在画面上点击元素", "warning");
          return;
        }
        await explore(payload.element, payload.action === "guided-explore" ? text : undefined);
        setInputValue("");
      }
    },
    [onboardingMode, appendDreamSelf, generateInitial, setRefinedPrompt, refine, explore, showToast]
  );

  const handleCoachReady = useCallback(
    async (finalPrompt: string, _style: string) => {
      setShowCoach(false);
      setLocalRefinedPrompt(finalPrompt);
      setRefinedPrompt(finalPrompt);
      await generateInitial(finalPrompt, true);
    },
    [generateInitial, setRefinedPrompt]
  );

  // ===== 版本与心理分析 =====
  const handleSaveVersion = useCallback(() => {
    if (!activeNode) return;
    addVersion({ nodeId: activeNode.id, title: activeNode.branchLabel });
    showToast("已存为新版本", "success");
  }, [activeNode, addVersion, showToast]);

  const handleMarkClosest = useCallback(
    (versionId: string) => {
      markClosest(versionId);
      showToast("已标记为最接近的版本", "success");
    },
    [markClosest, showToast]
  );

  const handleAnalyze = useCallback(async () => {
    const selected = project.versions.find((v) => v.id === project.selectedVersionId);
    const versionNode = selected ? project.nodes[selected.nodeId] : activeNode;
    if (!versionNode) return;
    setAnalysisTargetNode(versionNode);
    setAnalysisOpen(true);
    setAnalysisBusy(true);
    const result = await analyze(
      versionNode.assetId,
      versionNode.prompt,
      {
        scene: versionNode.branchLabel,
        emotion: "未知",
        elements: versionNode.sceneRegions.map((r) => r.label),
      },
      Object.values(project.nodes)
        .filter((n) => n.origin === "ai-exploration")
        .map((n) => n.branchLabel)
    );
    if (result) {
      const { exploreNote: _exploreNote, ...artifact } = result;
      setAnalysis({ ...artifact, createdAt: new Date().toISOString() });
    }
    setAnalysisBusy(false);
  }, [project.versions, project.selectedVersionId, project.nodes, activeNode, analyze, setAnalysis]);

  const handleClearSession = useCallback(async () => {
    setClearConfirmOpen(false);
    try {
      localStorage.removeItem("oneira-active-project-id");
    } catch {
      // ignore
    }
    await removeProject();
    setOnboardingForceCount((c) => c + 1);
    showToast("会话已清空", "success");
    if (typeof window !== "undefined") window.location.reload();
  }, [removeProject, showToast]);

  const breadcrumbPath = getPathFromRoot();

  return (
    <div className="relative flex flex-col h-screen min-h-screen overflow-hidden">
      <header className="relative z-20 shrink-0 px-6 py-2.5 flex items-center justify-between border-b border-[color:var(--border)]">
        <div className="flex items-baseline gap-3">
          <h1
            className="text-2xl font-bold tracking-wide text-gradient-lavender"
            style={{ fontFamily: "var(--font-serif), serif" }}
          >
            AI梦境还原器
          </h1>
          <p className="text-xs text-[color:var(--foreground-subtle)] tracking-widest">
            无限探索
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* 阶段进度：避开右上角，独立槽位 */}
          {operationStage && operationStatus === "running" && (
            <StageProgress
              kind="generate"
              stage={operationStage}
              status={operationStatus}
              onCancel={cancel}
            />
          )}
          <button type="button" onClick={() => setOnboardingForceCount((count) => count + 1)} aria-label="重新播放新手引导" title="新手引导" className="icon-button">?</button>
          <button type="button" onClick={() => setArchiveOpen(true)} aria-label="打开梦境档案馆" title="梦境档案馆" className="icon-button">档</button>
          <button type="button" onClick={() => setDreamSelfOpen(true)} aria-label="管理 Dream Self" title="Dream Self" className="icon-button">我</button>
          {hasNodes && (
            <button
              type="button"
              onClick={() => setClearConfirmOpen(true)}
              aria-label="清空会话"
              title="清空会话"
              className="icon-button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <DemoBanner visible={demoMode} onRecover={() => { setDemoMode(false); showToast("已切回真实模式", "info"); }} />

      {/* 面包屑 */}
      {breadcrumbPath.length > 0 && (
        <nav
          aria-label="探索路径"
          className="relative z-20 shrink-0 h-10 mx-4 mt-2 glass-overlay rounded-lg px-2 flex items-center gap-2 text-xs overflow-x-auto"
        >
          {breadcrumbPath.map((node, i) => (
            <span key={node.id} className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActive(node.id)}
                className={`px-2 py-0.5 rounded ${
                  node.id === activeNode?.id
                    ? "bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)]"
                    : "hover:bg-[color:var(--border)]"
                }`}
                aria-current={node.id === activeNode?.id ? "page" : undefined}
              >
                {node.branchLabel}
                {getChildCount(node.id) > 1 && (
                  <span className="ml-1 text-[10px] text-[color:var(--foreground-subtle)]">
                    · {getChildCount(node.id)}
                  </span>
                )}
              </button>
              {i < breadcrumbPath.length - 1 && <span aria-hidden>›</span>}
            </span>
          ))}
          {activeNode && activeChildCount > 1 && (
            <button
              type="button"
              onClick={() => setBranchPickerNode(activeNode)}
              className="ml-2 px-2 py-0.5 rounded border border-[color:var(--lavender)] text-[color:var(--lavender-bright)]"
            >
              分支({activeChildCount})
            </button>
          )}
        </nav>
      )}

      <main className="relative z-10 flex-1 min-h-0 flex">
        <div className="relative flex-1 mx-4 my-2 canvas-stage">
          <DreamCanvas
            imageUrl={currentImageUrl}
            isGenerating={isGenerating}
            semanticTags={null}
            sceneRegions={sceneRegions}
            transition={hasNodes ? "lens" : "reveal"}
            onDirectExplore={handleDirectExplore}
            onShiftClick={handleShiftClick}
          />

          {!hasNodes && !isGenerating && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 glass-overlay rounded-full px-4 py-2 fade-in-up pointer-events-none">
              <p className="text-xs text-[color:var(--foreground-muted)] tracking-wide">
                在下方输入框描述你的梦境，开始还原
              </p>
            </div>
          )}

          {/* 版本操作浮层（仅在有版本时显示） */}
          {hasNodes && (
            <div className="absolute top-4 right-4 z-30 flex flex-col gap-2 max-w-xs">
              <button
                type="button"
                onClick={handleSaveVersion}
                className="px-3 py-1.5 text-xs rounded-md border border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)] hover:bg-[color:var(--lavender)] hover:text-[color:var(--background)] transition-colors"
              >
                保存为版本
              </button>
              {project.selectedVersionId && (
                <button
                  type="button"
                  onClick={() => handleMarkClosest(project.selectedVersionId!)}
                  className="px-3 py-1.5 text-xs rounded-md border border-[color:var(--border)] text-[color:var(--foreground-subtle)] hover:border-[color:var(--lavender)] hover:text-[color:var(--foreground)] transition-colors"
                >
                  这张最像！
                </button>
              )}
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analysisBusy || !project.selectedVersionId}
                className="px-3 py-1.5 text-xs rounded-md border border-[color:var(--lavender)] bg-[color:var(--lavender-soft)] text-[color:var(--lavender-bright)] hover:bg-[color:var(--lavender)] hover:text-[color:var(--background)] transition-colors disabled:opacity-50"
              >
                {analysisBusy ? "正在分析…" : "读读这个梦"}
              </button>
            </div>
          )}
        </div>
      </main>

      <div className="relative z-20 shrink-0 px-4 pb-3">
        <div className="flex items-end gap-2">
          <VoiceHoldButton
            disabled={isGenerating}
            onTranscript={(text) => setInputValue((value) => (value ? `${value} ${text}` : text))}
            onUnsupported={(message) => showToast(message, "warning")}
          />
          <div className="min-w-0 flex-1">
            <UnifiedInput
              value={inputValue}
              selectedElement={null}
              hasActiveNode={Boolean(activeNode)}
              isGenerating={isGenerating}
              onChange={setInputValue}
              onSubmit={handleSubmit}
              onClearElement={() => {}}
            />
          </div>
        </div>
      </div>

      {popover && (
        <ExplorationPopover
          position={popover.position}
          element={popover.element}
          identifying={popover.identifying}
          onExplore={handlePopoverConfirm}
          onCancel={() => setPopover(null)}
        />
      )}

      {branchPickerNode && activeNode && (
        <BranchPicker
          node={branchPickerNode}
          branches={branchPickerNode.childIds
            .map((id) => project.nodes[id])
            .filter((n): n is DreamNode => Boolean(n))}
          activeChildId={activeNode.id}
          onSelect={(id) => {
            setActive(id);
            setBranchPickerNode(null);
          }}
          onClose={() => setBranchPickerNode(null)}
        />
      )}

      {showCoach && (
        <PromptCoach
          initialDescription={refinedPrompt || inputValue}
          round={coachRound}
          onReady={handleCoachReady}
          onCancel={() => setShowCoach(false)}
        />
      )}

      <Onboarding force={onboardingForceCount > 0} onModeSelected={setOnboardingMode} key={`onboarding-${onboardingForceCount}`} />

      {archiveOpen && (
        <DreamArchive
          currentProjectId={project.id}
          onOpenProject={(id) => {
            void loadById(id);
            setArchiveOpen(false);
          }}
          onCreateProject={() => {
            setArchiveOpen(false);
            setClearConfirmOpen(true);
          }}
          onClose={() => setArchiveOpen(false)}
        />
      )}

      {dreamSelfOpen && (
        <DreamSelfManager
          activeProfileId={project.activeDreamSelfId}
          onSelect={setDreamSelf}
          onClose={() => setDreamSelfOpen(false)}
        />
      )}

      <ConfirmModal
        open={clearConfirmOpen}
        title="清空会话"
        message="将清除当前项目和所有节点，此操作不可撤销。确定继续吗？"
        confirmText="清空"
        cancelText="取消"
        variant="danger"
        onConfirm={handleClearSession}
        onCancel={() => setClearConfirmOpen(false)}
      />

      {analysisOpen && analysisTargetNode && (
        <PsychologicalAnalysis
          targetNode={analysisTargetNode}
          exploreTendency={Object.values(project.nodes)
            .filter((n) => n.origin === "ai-exploration")
            .map((n) => n.branchLabel)}
          onClose={() => {
            setAnalysisOpen(false);
            setAnalysisTargetNode(null);
          }}
          analyze={analyze}
          artifact={project.analysis}
          autoRun={false}
        />
      )}
    </div>
  );
}
