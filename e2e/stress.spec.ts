import { expect, test } from "@playwright/test";

test("Mock 生成接口可连续完成 20 次", async ({ request }) => {
  for (let index = 0; index < 20; index += 1) {
    const response = await request.post("/api/generate", {
      data: {
        taskId: `stress-${index}-${Date.now()}`,
        prompt: `第 ${index + 1} 次压力测试：夜海与月亮`,
        skipAsk: true,
      },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.assetId).toBeTruthy();
  }
});