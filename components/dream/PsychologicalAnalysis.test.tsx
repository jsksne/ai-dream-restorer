// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PsychologicalAnalysis } from "./PsychologicalAnalysis";

vi.mock("@/hooks/useAgentStream", () => ({
  useAgentStream: () => ({
    deltaBuffer: {},
    status: "completed",
    error: undefined,
  }),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

afterEach(cleanup);

const sampleNode = {
  id: "n1",
  parentId: null,
  childIds: [],
  assetId: "11111111-1111-1111-1111-111111111111",
  prompt: "梦见大海与月亮",
  branchLabel: "海面",
  origin: "remembered" as const,
  sceneRegions: [],
  createdAt: new Date().toISOString(),
};

const sampleArtifact = {
  mode: "multimodal" as const,
  visualEvidence: [{ observation: "画面有月亮", confidence: 0.8 }],
  dreamClues: "海面上方有明亮的光源",
  emotionalThread: "平静但不孤寂",
  possibleConnections: "也许与近期休息相关",
  reflectionQuestions: ["你愿意停留多久？"],
  explorationTrace: [],
  disclaimer: "以下内容是供你自我探索的可能线索，不是诊断。",
  createdAt: new Date().toISOString(),
};

describe("PsychologicalAnalysis", () => {
  it("渲染四段内容标题", () => {
    render(
      <PsychologicalAnalysis
        targetNode={sampleNode}
        onClose={() => {}}
        analyze={async () => ({ exploreNote: null, disclaimer: "d" })}
        artifact={sampleArtifact}
      />
    );
    expect(screen.getByText("梦境线索")).toBeInTheDocument();
    expect(screen.getByText("情绪脉络")).toBeInTheDocument();
    expect(screen.getByText("可能联想")).toBeInTheDocument();
    expect(screen.getByText("可思考问题")).toBeInTheDocument();
  });

  it("显示多模态分析标签", () => {
    render(
      <PsychologicalAnalysis
        targetNode={sampleNode}
        onClose={() => {}}
        analyze={async () => ({ exploreNote: null, disclaimer: "d" })}
        artifact={sampleArtifact}
      />
    );
    expect(screen.getByText(/多模态分析/)).toBeInTheDocument();
  });

  it("显示文字分析模式标签", () => {
    render(
      <PsychologicalAnalysis
        targetNode={sampleNode}
        onClose={() => {}}
        analyze={async () => ({ exploreNote: null, disclaimer: "d" })}
        artifact={{ ...sampleArtifact, mode: "text-only", visualEvidence: [] }}
      />
    );
    expect(screen.getByText(/文字分析模式/)).toBeInTheDocument();
  });

  it("显示免责声明", () => {
    render(
      <PsychologicalAnalysis
        targetNode={sampleNode}
        onClose={() => {}}
        analyze={async () => ({ exploreNote: null, disclaimer: "d" })}
        artifact={sampleArtifact}
      />
    );
    expect(screen.getByText(/不是诊断/)).toBeInTheDocument();
  });

  it("包含视觉证据细节", () => {
    render(
      <PsychologicalAnalysis
        targetNode={sampleNode}
        onClose={() => {}}
        analyze={async () => ({ exploreNote: null, disclaimer: "d" })}
        artifact={sampleArtifact}
      />
    );
    expect(screen.getByText(/画面有月亮/)).toBeInTheDocument();
  });
});