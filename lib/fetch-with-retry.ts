// 带超时 + 智能重试 + abort 传播的 fetch 封装
// 重试分类规则：
// - 网络中断、408、429、5xx → 自动重试 1 次（短退避后）
// - 400、401、403、余额不足 → 不重试
// - 用户取消 → 不重试
// - AbortError → 不重试

export type RetryableKind = "network" | "timeout" | "429" | "5xx" | "408";

export interface FetchWithRetryOptions {
  /** 用户主动取消的 signal */
  signal?: AbortSignal;
  /** 总超时（毫秒） */
  timeoutMs: number;
  /** 最大重试次数（含首次） */
  maxRetries?: number;
  /** 自定义 fetch（测试用） */
  fetchImpl?: typeof fetch;
  /** 重试前的延迟基数（毫秒）；实际延迟 = base * attempt + 抖动 */
  retryBaseMs?: number;
}

export interface FetchRetryResult<T> {
  ok: boolean;
  status?: number;
  data?: T;
  error?: string;
  retryCount: 0 | 1;
  /** 是否因超时中止 */
  timedOut?: boolean;
  /** 是否因用户取消中止 */
  cancelled?: boolean;
}

const DEFAULT_BASE = 800;

export async function fetchWithRetry<T = unknown>(
  url: string,
  init: RequestInit,
  opts: FetchWithRetryOptions
): Promise<FetchRetryResult<T>> {
  const maxRetries = Math.max(1, opts.maxRetries ?? 2);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const base = opts.retryBaseMs ?? DEFAULT_BASE;
  let retryCount: 0 | 1 = 0;
  let lastStatus = 0;
  let lastError: string | undefined;
  let timedOut = false;
  let cancelled = false;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // 用户 signal 可以来自 opts.signal 或 init.signal（兼容两种传法）
    const userSignal: AbortSignal | undefined = opts.signal ?? (init.signal as AbortSignal | undefined);
    // 合并用户 signal 与超时 signal：使用 fallback 方式以兼容旧 Node 版本
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), opts.timeoutMs);
    let combinedSignal: AbortSignal;
    if (userSignal && typeof AbortSignal.any === "function") {
      combinedSignal = AbortSignal.any([userSignal, timeoutController.signal]);
    } else {
      // 简单实现：每次循环创建新 controller；监听 userSignal 的 abort
      combinedSignal = timeoutController.signal;
      if (userSignal) {
        const onAbort = () => {
          try {
            timeoutController.abort();
          } catch {
            // ignore
          }
        };
        if (userSignal.aborted) {
          onAbort();
        } else {
          userSignal.addEventListener("abort", onAbort, { once: true });
        }
      }
    }

    try {
      const res = await fetchImpl(url, { ...init, signal: combinedSignal });
      clearTimeout(timer);
      lastStatus = res.status;
      if (res.ok) {
        let data: T | undefined;
        try {
          data = (await res.json()) as T;
        } catch {
          // 非 JSON 响应：返回成功但不携带 data
        }
        return { ok: true, status: res.status, data, retryCount };
      }
      // 错误响应：判断是否需要重试
      if (isRetryableStatus(res.status) && attempt + 1 < maxRetries) {
        await backoff(base, attempt, opts.signal);
        retryCount = 1;
        continue;
      }
      // 读取错误体作为 lastError
      try {
        const body = (await res.json()) as { error?: string };
        lastError = body.error ?? `${res.status} ${res.statusText}`;
      } catch {
        lastError = `${res.status} ${res.statusText}`;
      }
      return {
        ok: false,
        status: res.status,
        error: lastError,
        retryCount,
      };
    } catch (e) {
      clearTimeout(timer);
      const userSignal: AbortSignal | undefined = opts.signal ?? (init.signal as AbortSignal | undefined);
      // 优先判断用户主动取消（即使 combinedSignal 因外部 signal 也 abort 时）
      if (userSignal?.aborted) {
        cancelled = true;
        return { ok: false, error: "请求已取消", retryCount, cancelled: true };
      }
      if (timeoutController.signal.aborted && !userSignal) {
        timedOut = true;
        lastError = `请求超时 (${opts.timeoutMs}ms)`;
        if (attempt + 1 < maxRetries) {
          await backoff(base, attempt, userSignal);
          retryCount = 1;
          continue;
        }
        return { ok: false, error: lastError, retryCount, timedOut: true };
      }
      // 其它 abort / error：若为 AbortError 且未匹配以上，则视为取消
      if (e instanceof Error && (e.name === "AbortError" || /aborted/i.test(e.message))) {
        if (userSignal?.aborted) {
          cancelled = true;
          return { ok: false, error: "请求已取消", retryCount, cancelled: true };
        }
        if (timeoutController.signal.aborted) {
          timedOut = true;
          lastError = `请求超时 (${opts.timeoutMs}ms)`;
          if (attempt + 1 < maxRetries) {
            await backoff(base, attempt, userSignal);
            retryCount = 1;
            continue;
          }
          return { ok: false, error: lastError, retryCount, timedOut: true };
        }
      }
      // 网络错误
      lastError = e instanceof Error ? e.message : "网络错误";
      if (attempt + 1 < maxRetries) {
        await backoff(base, attempt, userSignal);
        retryCount = 1;
        continue;
      }
      return { ok: false, error: lastError, retryCount };
    }
  }

  return {
    ok: false,
    status: lastStatus || undefined,
    error: lastError ?? "未知错误",
    retryCount,
    timedOut,
    cancelled,
  };
}

function isRetryableStatus(status: number): boolean {
  if (status === 408 || status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

async function backoff(baseMs: number, attempt: number, signal?: AbortSignal): Promise<void> {
  const jitter = Math.random() * 200;
  const delay = baseMs * Math.pow(1.5, attempt) + jitter;
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, delay);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      if (signal.aborted) {
        clearTimeout(timer);
        resolve();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}