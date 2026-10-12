import { describe, expect, it } from 'vitest';

import {
  LINGVA_AUTH_RATE_LIMIT_MODES,
  createLingvaAuthRateLimitPayload,
  parseLingvaAuthRateLimitResponse,
} from './auth-rate-limit';

describe('auth rate-limit contract', () => {
  it('normalizes hosted limiter payloads', () => {
    expect(
      createLingvaAuthRateLimitPayload({
        rateLimitKey: ' signin:203.0.113.10:user@example.com ',
        maxAttempts: 3,
        windowSeconds: 120,
      })
    ).toEqual({
      mode: 'record',
      rateLimitKey: 'signin:203.0.113.10:user@example.com',
      maxAttempts: 3,
      windowSeconds: 120,
    });
  });

  it('supports clear requests', () => {
    expect(
      createLingvaAuthRateLimitPayload({
        mode: LINGVA_AUTH_RATE_LIMIT_MODES.clear,
        rateLimitKey: 'signin:203.0.113.10:user@example.com',
      }).mode
    ).toBe('clear');
  });

  it('rejects invalid keys', () => {
    expect(() => createLingvaAuthRateLimitPayload({ rateLimitKey: '' })).toThrow(/rateLimitKey/);
  });

  it('validates response shape and clamps retry metadata', () => {
    expect(
      parseLingvaAuthRateLimitResponse({
        allowed: false,
        count: 9,
        maxAttempts: 8,
        resetAt: 1800,
        retryAfterSeconds: -5,
      })
    ).toEqual({
      allowed: false,
      count: 9,
      maxAttempts: 8,
      resetAt: 1800,
      retryAfterSeconds: 0,
    });
  });
});
