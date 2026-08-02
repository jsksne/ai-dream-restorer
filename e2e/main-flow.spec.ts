import { expect, test } from "@playwright/test";

test("首次访问可完成一次梦境生成", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/");

  await expect(page.getByText("我来掌舵")).toBeVisible();
  await page.getByText("AI 带我冲").click();
  await page.getByRole("button", { name: "开始还原我的梦" }).click();

  const input = page.getByRole("textbox", { name: "梦境描述输入框" });
  await input.fill("我漂浮在有月亮的深蓝海面上");
  await input.press("Enter");

  await expect(page.getByRole("dialog", { name: "提示词智能体" })).toBeVisible();
  await page.getByText("记不清，交给 AI").click();
  await expect(page.getByAltText("当前梦境画面")).toBeVisible();
});

test("关键固定提示无需页面滚动即可看到", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await expect(page.getByText("AI 带我冲")).toBeInViewport();
  await expect(page.getByRole("button", { name: "先选择一种方式" })).toBeInViewport();
});