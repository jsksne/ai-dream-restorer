import { describe, it, expect, vi } from "vitest";
import { fetchWithRetry } from "./fetch-with-retry";

describe("fetchWithRetry", () => {
  it("成功响应直接返回", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ hello: "world" }),
    });
    const result = await fetchWithRetry(
      "http://localhost/api",
      { method: "GET" },
      { timeoutMs: 1000, fetchImpl: fetchMock as unknown as typeof fetch }
    );
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ hello: "world" });
    expect(result.retryCount).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("429 重试一次后成功", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });
    const result = await fetchWithRetry(
      "http://localhost/api",
      { method: "GET" },
      {
        timeoutMs: 1000,
        fetchImpl: fetchMock as unknown as typeof fetch,
        retryBaseMs: 10,
        maxRetries: 2,
      }
    );
    expect(result.ok).toBe(true);
    expect(result.retryCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("5xx 重试一次后失败", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Server Error",
        json: async () => ({ error: "boom" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Server Error",
        json: async () => ({ error: "boom" }),
      });
    const result = await fetchWithRetry(
      "http://localhost/api",
      { method: "GET" },
      {
        timeoutMs: 1000,
        fetchImpl: fetchMock as unknown as typeof fetch,
        retryBaseMs: 10,
        maxRetries: 2,
      }
    );
    expect(result.ok).toBe(false);
    expect(result.retryCount).toBe(1);
    expect(result.status).toBe(500);
    expect(result.error).toContain("boom");
  });

  it("400 不重试", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ error: "bad" }),
    });
    const result = await fetchWithRetry(
      "http://localhost/api",
      { method: "GET" },
      {
        timeoutMs: 1000,
        fetchImpl: fetchMock as unknown as typeof fetch,
        maxRetries: 2,
        retryBaseMs: 10,
      }
    );
    expect(result.ok).toBe(false);
    expect(result.retryCount).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("401/403 不重试", async () => {
    for (const status of [401, 403]) {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: false,
        status,
        statusText: "Auth",
        json: async () => ({}),
      });
      const result = await fetchWithRetry(
        "http://localhost/api",
        { method: "GET" },
        {
          timeoutMs: 1000,
          fetchImpl: fetchMock as unknown as typeof fetch,
          maxRetries: 2,
          retryBaseMs: 10,
        }
      );
      expect(result.retryCount).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it("超时一次后重试成功", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => {
              const e = new Error("aborted");
              e.name = "AbortError";
              reject(e);
            }, 50)
          )
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });
    const result = await fetchWithRetry(
      "http://localhost/api",
      { method: "GET" },
      {
        timeoutMs: 30,
        fetchImpl: fetchMock as unknown as typeof fetch,
        maxRetries: 2,
        retryBaseMs: 5,
      }
    );
    expect(result.ok).toBe(true);
    expect(result.retryCount).toBe(1);
  });

  it("用户取消立即中止（cancelled=true，不重试）", async () => {
    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      return new Promise((_, reject) => {
        const sig = init?.signal;
        if (sig) {
          sig.addEventListener("abort", () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            reject(e);
          });
        }
      });
    });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);
    const result = await fetchWithRetry(
      "http://localhost/api",
      { method: "GET", signal: controller.signal },
      {
        timeoutMs: 1000,
        fetchImpl: fetchMock as unknown as typeof fetch,
        maxRetries: 1,
        retryBaseMs: 5,
      }
    );
    expect(result.ok).toBe(false);
    expect(result.cancelled).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }, 2000);

  it("超时且不重试时返回 timedOut", async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((_, reject) =>
          setTimeout(() => {
            const e = new Error("aborted");
            e.name = "AbortError";
            reject(e);
          }, 50)
        )
    );
    const result = await fetchWithRetry(
      "http://localhost/api",
      { method: "GET" },
      {
        timeoutMs: 10,
        fetchImpl: fetchMock as unknown as typeof fetch,
        maxRetries: 1,
        retryBaseMs: 5,
      }
    );
    expect(result.ok).toBe(false);
    expect(result.timedOut).toBe(true);
  });
});