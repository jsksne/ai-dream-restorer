import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // 这两个规则在以下合法场景下产生误报：
      // - 从 localStorage / sessionStorage 恢复状态（useSession / Onboarding）
      // - 图像预加载 + load 状态同步（ImageReveal）
      // - SSE / 外部 store 状态同步（PsychologicalAnalysis 监听 useAgentStream）
      // - GSAP 动画生命周期回调（DreamCanvas lens transition）
      // React 团队明确承认这些是「与外部系统同步」的合法用例，不应阻断构建。
      "react-hooks/set-state-in-effect": "off",
      // 允许下划线前缀的未使用参数/变量（接口签名占位用）
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
