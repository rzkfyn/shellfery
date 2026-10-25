import { useSettingsStore } from '../stores/settingsStore';
import { APP_VERSION } from '../version';

export const CRASHPULSE_ENDPOINT = 'https://crashpulse.darktama.dev/api/v1/report';
export const DEFAULT_PROJECT_KEY = 'shellferry-client-default';
export const THROTTLE_WINDOW_MS = 60_000; // 1 minute deduplication

export type CrashLevel = 'error' | 'fatal' | 'warning' | 'info';

export interface CrashReportOptions {
  message: string;
  error?: Error | unknown;
  level?: CrashLevel;
  componentStack?: string;
  extra?: Record<string, unknown>;
}

export interface CrashReportPayload {
  message: string;
  level: CrashLevel;
  stack?: string;
  componentStack?: string;
  appVersion: string;
  platform: string;
  timestamp: string;
  extra?: Record<string, unknown>;
}

/**
 * In-memory deduplication cache: errorKey -> timestamp (ms)
 */
const recentReports = new Map<string, number>();

export function clearReportCache(): void {
  recentReports.clear();
}

/**
 * Client-side sanitization function:
 * - Strip Windows user paths: C:\Users\[a-zA-Z0-9_.-]+ -> C:\Users\[USER] (and double-escaped C:\\Users\\[USER])
 * - Strip Unix user paths: /home/[a-zA-Z0-9_.-]+ -> /home/[USER] (and /Users/[USER] on macOS)
 * - Strip SSH private key blocks and headers: -----BEGIN.*KEY----- -> [REDACTED_SSH_KEY]
 * - Strip sensitive token/password substrings
 * - Strip IPv4 and IPv6 addresses
 */
export function sanitizeCrashData(input: string): string {
  if (!input || typeof input !== 'string') return '';

  return (
    input
      // SSH full key blocks (if embedded)
      .replace(
        /-----BEGIN[A-Z0-9_ -]*KEY-----[\s\S]*?-----END[A-Z0-9_ -]*KEY-----/gi,
        '[REDACTED_SSH_KEY]'
      )
      // Any remaining standalone SSH key headers
      .replace(/-----(?:BEGIN|END)[^\r\n]*KEY-----/gi, '[REDACTED_SSH_KEY]')
      // Windows double-escaped paths (e.g. in JSON or escaped stack traces)
      .replace(/[a-zA-Z]:\\\\Users\\\\[a-zA-Z0-9_.-]+/gi, 'C:\\\\Users\\\\[USER]')
      // Windows standard paths
      .replace(/[a-zA-Z]:\\Users\\[a-zA-Z0-9_.-]+/gi, 'C:\\Users\\[USER]')
      // Windows forward-slash paths
      .replace(/[a-zA-Z]:\/Users\/[a-zA-Z0-9_.-]+/gi, 'C:/Users/[USER]')
      // Unix / Linux user paths
      .replace(/\/home\/[a-zA-Z0-9_.-]+/g, '/home/[USER]')
      // macOS user paths
      .replace(/\/Users\/[a-zA-Z0-9_.-]+/g, '/Users/[USER]')
      // Tokens, passwords, and secrets
      .replace(
        /(password|passwd|pwd|secret|token|api_key|apikey|access_token|private_key)\s*([:=])\s*(['"]?)[^\s'",;}{\]]+(\3)/gi,
        '$1$2$3[REDACTED]$4'
      )
      // Bearer / Basic tokens
      .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, '$1[REDACTED]')
      .replace(/(Basic\s+)[A-Za-z0-9+/]+=*/gi, '$1[REDACTED]')
      // IPv4 addresses (4 octets 0-255)
      .replace(
        /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
        '[IP]'
      )
      // IPv6 addresses
      .replace(/\b(?:[a-fA-F0-9]{1,4}:){2,7}(?:[a-fA-F0-9]{1,4}|:)\b/g, '[IP]')
  );
}

/**
 * Recursively sanitize objects/records.
 */
export function sanitizeObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeCrashData(obj);
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') {
      result[key] = sanitizeCrashData(val);
    } else if (typeof val === 'object' && val !== null) {
      result[key] = sanitizeObject(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Check whether crash reporting is enabled by user preference.
 */
export function isCrashReportingEnabled(): boolean {
  try {
    const storeState = useSettingsStore.getState();
    if (storeState?.settings && typeof storeState.settings.sendCrashReports === 'boolean') {
      return storeState.settings.sendCrashReports;
    }
  } catch {}

  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('openterm_app_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.sendCrashReports === 'boolean') {
          return parsed.sendCrashReports;
        }
      }
    } catch {}
  }

  return true;
}

/**
 * Throttle check: returns true if this error was already reported within the last minute.
 */
function isThrottled(fingerprint: string, now = Date.now()): boolean {
  // Prune expired entries
  for (const [key, timestamp] of recentReports.entries()) {
    if (now - timestamp > THROTTLE_WINDOW_MS * 2) {
      recentReports.delete(key);
    }
  }

  const lastSent = recentReports.get(fingerprint);
  if (lastSent && now - lastSent < THROTTLE_WINDOW_MS) {
    return true;
  }

  recentReports.set(fingerprint, now);
  return false;
}

/**
 * Report an error to CrashPulse with sanitization, deduplication, and user opt-out check.
 */
export function reportCrash(options: CrashReportOptions): boolean {
  if (!isCrashReportingEnabled()) {
    return false;
  }

  const rawMessage = options.message || (options.error instanceof Error ? options.error.message : 'Unknown error');
  const rawStack = options.error instanceof Error ? options.error.stack : undefined;

  // Deduplication key based on message and top stack trace
  const topStack = rawStack ? rawStack.split('\n').slice(0, 3).join('\n') : '';
  const fingerprint = `${rawMessage}::${topStack}`;

  if (isThrottled(fingerprint)) {
    return false;
  }

  const sanitizedMessage = sanitizeCrashData(rawMessage);
  const sanitizedStack = rawStack ? sanitizeCrashData(rawStack) : undefined;
  const sanitizedComponentStack = options.componentStack ? sanitizeCrashData(options.componentStack) : undefined;
  const sanitizedExtra = options.extra ? (sanitizeObject(options.extra) as Record<string, unknown>) : undefined;

  const payload: CrashReportPayload = {
    message: sanitizedMessage,
    level: options.level || 'error',
    stack: sanitizedStack,
    componentStack: sanitizedComponentStack,
    appVersion: APP_VERSION,
    platform: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    timestamp: new Date().toISOString(),
    extra: sanitizedExtra,
  };

  const projectKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CRASHPULSE_PROJECT_KEY) ||
    DEFAULT_PROJECT_KEY;

  try {
    fetch(CRASHPULSE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Project-Key': projectKey,
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Fire-and-forget: silently ignore delivery failures to prevent crash loops
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Register global error and unhandled promise rejection listeners.
 */
let isInitialized = false;

export function initCrashReporter(): void {
  if (isInitialized || typeof window === 'undefined') {
    return;
  }
  isInitialized = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    reportCrash({
      message: event.message || 'Window error event',
      error: event.error,
      level: 'error',
      extra: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
        ? reason
        : 'Unhandled Promise Rejection';

    reportCrash({
      message,
      error: reason instanceof Error ? reason : undefined,
      level: 'error',
      extra: {
        reason: typeof reason === 'object' && reason !== null ? JSON.stringify(reason) : String(reason),
      },
    });
  });
}
