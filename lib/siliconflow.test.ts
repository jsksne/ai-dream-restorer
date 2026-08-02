import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("siliconflow VLM 模型常量配置", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.VLM_MODEL;
    delete process.env.AGENT_ASK_MODEL;
    delete process.env.SUGGESTION_MODEL;
    delete process.env.SUB_AGENT_MODEL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("默认 VLM 应为 Qwen3-VL-8B-Instruct", async () => {
    vi.resetModules();
    const { VLM_MODEL } = await import("./siliconflow");
    expect(VLM_MODEL).toBe("Qwen/Qwen3-VL-8B-Instruct");
  });

  it("默认 AGENT_ASK_MODEL 应为 Qwen2.5-7B-Instruct", async () => {
    vi.resetModules();
    const { AGENT_ASK_MODEL } = await import("./siliconflow");
    expect(AGENT_ASK_MODEL).toBe("Qwen/Qwen2.5-7B-Instruct");
  });

  it("VLM_MODEL 可通过环境变量覆盖", async () => {
    process.env.VLM_MODEL = "Qwen/Qwen-Custom-VLM";
    vi.resetModules();
    const { VLM_MODEL } = await import("./siliconflow");
    expect(VLM_MODEL).toBe("Qwen/Qwen-Custom-VLM");
  });
});

describe("siliconflow VLM 函数模型路由", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.SILICONFLOW_API_KEY = "sk-test";
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generateSemanticTags 应使用 VLM_MODEL 作为请求模型", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '{"scene":"海洋","emotion":"宁静","elements":["大海","天空"]}',
            },
          },
        ],
      }),
    });

    const { generateSemanticTags } = await import("./siliconflow");
    await generateSemanticTags("https://example.com/test.png");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.model).toBe("Qwen/Qwen3-VL-8B-Instruct");
  });

  it("identifyElement 应使用 VLM_MODEL 与归一化坐标", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"element":"月亮"}' } }],
      }),
    });

    const { identifyElement } = await import("./siliconflow");
    await identifyElement("https://example.com/test.png", 0.25, 0.5);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    const text = body.messages[0].content.find(
      (c: { type: string }) => c.type === "text"
    );
    expect(text.text).toContain("0.250");
    expect(text.text).toContain("0.500");
  });

  it("外部 abort 信号应能中断上游请求", async () => {
    fetchMock.mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            reject(e);
          });
        })
    );

    const { generateSemanticTags } = await import("./siliconflow");
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);
    await expect(
      generateSemanticTags("https://example.com/test.png", controller.signal)
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("错误详情中的 sk- 前缀 key 被清理", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({
        error: "Invalid API key sk-abc123def456 provided",
      }),
    });

    const { generateSemanticTags } = await import("./siliconflow");
    await expect(generateSemanticTags("https://example.com/test.png")).rejects.toThrow(
      /sk-\*\*\*/
    );
  });
});

describe("extractJson 处理 7B 模型尾部多余字符", () => {
  it("应当从裸 JSON 中正确解析", async () => {
    const { extractJson } = await import("./siliconflow");
    expect(extractJson<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it("应当从 markdown 代码块中提取 JSON", async () => {
    const { extractJson } = await import("./siliconflow");
    const out = extractJson<{ a: number }>("```json\n{\"a\": 2}\n```");
    expect(out).toEqual({ a: 2 });
  });

  it("应当处理 7B 模型输出尾部多余字符", async () => {
    const { extractJson } = await import("./siliconflow");
    const out = extractJson<{ needAsk: boolean }>(
      '{"needAsk": true}some trailing text'
    );
    expect(out).toEqual({ needAsk: true });
  });

  it("应当正确处理嵌套 JSON", async () => {
    const { extractJson } = await import("./siliconflow");
    const out = extractJson<{ inner: { x: number } }>(
      '{"inner": {"x": 1}} trailing junk'
    );
    expect(out).toEqual({ inner: { x: 1 } });
  });

  it("无效输入应当抛出错误", async () => {
    const { extractJson } = await import("./siliconflow");
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("resolveImageForProvider 路径限制", () => {
  beforeEach(() => {
    process.env.SILICONFLOW_API_KEY = "sk-test";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("data: URL 直接返回", async () => {
    const { resolveImageForProvider } = await import("./siliconflow");
    const data = "data:image/png;base64,AAA";
    expect(await resolveImageForProvider(data)).toBe(data);
  });

  it("https URL 直接返回", async () => {
    const { resolveImageForProvider } = await import("./siliconflow");
    expect(await resolveImageForProvider("https://example.com/x.png")).toBe(
      "https://example.com/x.png"
    );
  });

  it("以 / 开头的本地路径被当作 assetId 读取", async () => {
    const { resolveImageForProvider } = await import("./siliconflow");
    await expect(resolveImageForProvider("/etc/passwd")).rejects.toThrow();
  });
});