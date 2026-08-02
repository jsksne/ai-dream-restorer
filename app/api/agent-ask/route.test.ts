import { describe, expect, it, vi } from "vitest";

const { chat } = vi.hoisted(() => ({ chat: vi.fn() }));

vi.mock("@/lib/providers", () => ({
  getProvider: () => ({ mode: "live", chat }),
}));

import { POST } from "./route";

describe("POST /api/agent-ask", () => {
  it("在教练模式中向实时 provider 请求与当前描述相关的问题", async () => {
    chat.mockResolvedValueOnce(JSON.stringify({
      ready: false,
      question: "灯塔亮起时，你感到安心还是不安？",
      targetSlot: "emotion",
      options: [
        { id: "safe", label: "安心", value: "安心" },
        { id: "uneasy", label: "不安", value: "不安" },
      ],
      allowFreeText: true,
      summary: "夜海中的灯塔",
      recommendedStyle: "冷色电影感",
      missingHighImpactSlots: ["emotion"],
      round: 0,
    }));

    const response = await POST(new Request("http://localhost/api/agent-ask", {
      method: "POST",
      body: JSON.stringify({
        taskId: "coach-test",
        originalDescription: "我站在夜海边，看见一座忽明忽暗的灯塔。",
        answer: "coach",
        mode: "coach",
        round: 0,
      }),
    }));

    expect(chat).toHaveBeenCalledOnce();
    expect(chat.mock.calls[0]?.[0][1].content).toContain("灯塔");
    await expect(response.json()).resolves.toMatchObject({
      question: "灯塔亮起时，你感到安心还是不安？",
      targetSlot: "emotion",
      round: 0,
    });
  });
});
