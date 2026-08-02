import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    // 默认 node 环境；component 测试文件命名 *.test.tsx 通过 // @vitest-environment jsdom 切换
    environment: "node",
    // 单 fork 模式，避免 jsdom + 多 fork 在 Windows 上 OOM
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    // 不全局加载 setupFiles（含 DOM 断言），由 jsdom 测试文件自行 import
    include: [
      "lib/**/*.test.ts",
      "hooks/**/*.test.ts",
      "app/**/*.test.ts",
      "components/**/*.test.ts",
      "components/**/*.test.tsx",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
    },
  },
});
