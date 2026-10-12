export const LINGVA_AUTH_RATE_LIMIT_MODES = {
  clear: 'clear',
  record: 'record',
} as const;

export const LINGVA_AUTH_RATE_LIMIT_DEFAULT_MAX_ATTEMPTS = 8;
export const LINGVA_AUTH_RATE_LIMIT_DEFAULT_WINDOW_SECONDS = 900;
export const LINGVA_AUTH_RATE_LIMIT_MAX_KEY_LENGTH = 512;

export type LingvaAuthRateLimitMode = (typeof LINGVA_AUTH_RATE_LIMIT_MODES)[keyof typeof LINGVA_AUTH_RATE_LIMIT_MODES];

export interface LingvaAuthRateLimitPayload {
  mode: LingvaAuthRateLimitMode;
  rateLimitKey: string;
  maxAttempts: number;
  windowSeconds: number;
}

export interface LingvaAuthRateLimitResponse {
  allowed: boolean;
  count: number;
  maxAttempts: number;
  resetAt: number;
  retryAfterSeconds: number;
}

function normalizePositiveInteger(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isInteger(value) || typeof value !== 'number' || value < 1) {
    return fallback;
  }

  return Math.min(value, max);
}

/**
 * Creates the stable hosted auth limiter payload used by Lingva server routes.
 */
export function createLingvaAuthRateLimitPayload(input: {
  mode?: LingvaAuthRateLimitMode;
  rateLimitKey: string;
  maxAttempts?: number;
  windowSeconds?: number;
}): LingvaAuthRateLimitPayload {
  const rateLimitKey = input.rateLimitKey.trim();
  if (!rateLimitKey || rateLimitKey.length > LINGVA_AUTH_RATE_LIMIT_MAX_KEY_LENGTH) {
    throw new Error('rateLimitKey must be a non-empty string up to 512 characters.');
  }

  return {
    mode: input.mode ?? LINGVA_AUTH_RATE_LIMIT_MODES.record,
    rateLimitKey,
    maxAttempts: normalizePositiveInteger(input.maxAttempts, LINGVA_AUTH_RATE_LIMIT_DEFAULT_MAX_ATTEMPTS, 1000),
    windowSeconds: normalizePositiveInteger(input.windowSeconds, LINGVA_AUTH_RATE_LIMIT_DEFAULT_WINDOW_SECONDS, 86_400),
  };
}

/**
 * Validates hosted auth limiter responses before route handlers trust retry data.
 */
export function parseLingvaAuthRateLimitResponse(value: unknown): LingvaAuthRateLimitResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Auth rate-limit response must be an object.');
  }

  const payload = value as Partial<LingvaAuthRateLimitResponse>;
  if (typeof payload.allowed !== 'boolean') {
    throw new Error('Auth rate-limit response must include allowed.');
  }

  return {
    allowed: payload.allowed,
    count: typeof payload.count === 'number' ? payload.count : 0,
    maxAttempts: typeof payload.maxAttempts === 'number' ? payload.maxAttempts : 0,
    resetAt: typeof payload.resetAt === 'number' ? payload.resetAt : 0,
    retryAfterSeconds: typeof payload.retryAfterSeconds === 'number' ? Math.max(0, payload.retryAfterSeconds) : 0,
  };
}
