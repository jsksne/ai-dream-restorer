// ===== 错误处理工具 =====
// 区分超时/4xx/5xx/离线，402/403 → API key 提示
// 返回结构化错误供 API 路由统一返回 + 前端 toast 显示

/** 错误类型枚举 */
export type ErrorKind =
  | 'timeout'
  | 'client'      // 4xx
  | 'auth'        // 402/403（API key/余额）
  | 'server'      // 5xx
  | 'offline'     // 网络离线 / fetch 失败
  | 'unknown';

/** 结构化错误 */
export interface StructuredError {
  kind: ErrorKind;
  message: string;     // 用户可读文案
  status?: number;     // HTTP 状态码（如有）
  retryable: boolean;  // 是否可重试
}

/**
 * 从任意错误构造结构化错误
 *
 * 约定：siliconflow.ts 抛出的 Error message 形如 "[SiliconFlow] xxx 失败: 401 Unauthorized - ..."
 * 据此解析状态码
 */
export function toStructuredError(err: unknown): StructuredError {
  if (err instanceof Error) {
    const msg = err.message;

    // 网络离线
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        kind: 'offline',
        message: '网络已断开，请检查网络连接后重试',
        retryable: true,
      };
    }

    // fetch failed / TypeError（fetch 抛 TypeError）
    if (err.name === 'TypeError' || /fetch failed|network/i.test(msg)) {
      return {
        kind: 'offline',
        message: '无法连接到服务器，请检查网络后重试',
        retryable: true,
      };
    }

    // 超时（AbortError 或自定义 timeout）
    if (err.name === 'AbortError' || /timeout/i.test(msg)) {
      return {
        kind: 'timeout',
        message: '请求超时，请稍后重试',
        retryable: true,
      };
    }

    // 从 message 中提取状态码
    const statusMatch = msg.match(/\b(4\d\d|5\d\d)\b/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      if (status === 402 || status === 403) {
        return {
          kind: 'auth',
          message: 'API 鉴权失败或余额不足，请检查 SILICONFLOW_API_KEY 配置和账户余额',
          status,
          retryable: false,
        };
      }
      if (status >= 400 && status < 500) {
        return {
          kind: 'client',
          message: `请求错误 (${status})：${msg}`,
          status,
          retryable: false,
        };
      }
      if (status >= 500) {
        return {
          kind: 'server',
          message: `服务器错误 (${status})，请稍后重试`,
          status,
          retryable: true,
        };
      }
    }

    return {
      kind: 'unknown',
      message: msg,
      retryable: false,
    };
  }

  return {
    kind: 'unknown',
    message: typeof err === 'string' ? err : '未知错误',
    retryable: false,
  };
}

/** 把 StructuredError 转换为 HTTP Response（API 路由用） */
export function errorResponse(err: unknown): Response {
  const se = toStructuredError(err);
  const status =
    se.status ?? (se.kind === 'client' || se.kind === 'auth' ? 400 : se.kind === 'server' ? 502 : 500);
  return Response.json(
    {
      error: se.message,
      kind: se.kind,
      retryable: se.retryable,
    },
    { status }
  );
}
