/** Opt-in guarded HTTP transport. The server owns identity, admission and receipt authority. */
import { LINGVA_HTTP_METHODS } from './constants';
import {
  createLingvaGuardedApprovalContextPayload,
  createLingvaGuardedApprovalPayload,
  parseLingvaGuardedApprovalContextResponse,
  parseLingvaGuardedApprovalResponse,
  LINGVA_GUARDED_APPROVAL_RESPONSE_MAX_BYTES,
  type LingvaGuardedApprovalScope,
  type LingvaGuardedApprovalCommand,
  type LingvaGuardedApprovalContextResponse,
  type LingvaGuardedApprovalResponse,
} from './guarded-approval';

export const LINGVA_GUARDED_APPROVAL_HTTP_TIMEOUT_MS = 5000;
export const LINGVA_GUARDED_APPROVAL_HTTP_TOKEN_MAX_BYTES = 16 * 1024;
export const LINGVA_GUARDED_APPROVAL_HTTP_ERROR_KINDS = Object.freeze({
  invalidRequest: 'invalid-request',
  unauthenticated: 'unauthenticated',
  forbidden: 'forbidden',
  notFound: 'not-found',
  conflict: 'conflict',
  unavailable: 'unavailable',
  transport: 'transport',
  invalidResponse: 'invalid-response',
} as const);
export type LingvaGuardedApprovalHttpErrorKind =
  (typeof LINGVA_GUARDED_APPROVAL_HTTP_ERROR_KINDS)[keyof typeof LINGVA_GUARDED_APPROVAL_HTTP_ERROR_KINDS];
export type LingvaGuardedApprovalHttpPhase = 'local' | 'request';
export type LingvaGuardedApprovalHttpRecovery = 'none' | 'keep-command';
export interface LingvaGuardedApprovalHttpCallOptions {
  signal?: AbortSignal;
}
export interface LingvaGuardedApprovalHttpOptions {
  endpoint: string;
  getBearerToken: (signal: AbortSignal) => string | Promise<string>;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}
export interface LingvaGuardedApprovalHttpClient {
  getContext(
    scope: LingvaGuardedApprovalScope,
    options?: LingvaGuardedApprovalHttpCallOptions
  ): Promise<LingvaGuardedApprovalContextResponse>;
  approve(
    command: LingvaGuardedApprovalCommand,
    options?: LingvaGuardedApprovalHttpCallOptions
  ): Promise<LingvaGuardedApprovalResponse>;
}
const KINDS = LINGVA_GUARDED_APPROVAL_HTTP_ERROR_KINDS;
const MESSAGES: Record<LingvaGuardedApprovalHttpErrorKind, string> = {
  'invalid-request': 'Invalid guarded approval request.',
  unauthenticated: 'Guarded approval authentication required.',
  forbidden: 'Guarded approval access denied.',
  'not-found': 'Guarded approval target unavailable.',
  conflict: 'Guarded approval conflict.',
  unavailable: 'Guarded approval service unavailable.',
  transport: 'Guarded approval transport failed.',
  'invalid-response': 'Invalid guarded approval response.',
};

export class LingvaGuardedApprovalHttpError extends Error {
  declare readonly status?: number;
  constructor(
    readonly kind: LingvaGuardedApprovalHttpErrorKind,
    readonly phase: LingvaGuardedApprovalHttpPhase,
    readonly recovery: LingvaGuardedApprovalHttpRecovery,
    status?: number
  ) {
    super(MESSAGES[kind]);
    this.name = 'LingvaGuardedApprovalHttpError';
    if (status !== undefined) this.status = status;
  }
}

// Only internally produced failures are trusted. Dependency exceptions, including public errors,
// are classified anew and never copied into a public message or cause.
class Failure extends Error {
  constructor(
    readonly kind: LingvaGuardedApprovalHttpErrorKind,
    readonly status?: number
  ) {
    super('Guarded approval internal failure.');
  }
}
function endpointUrl(value: string): string {
  if (typeof value !== 'string' || value.trim() !== value || /[?#\\\s]/.test(value))
    throw new Failure(KINDS.invalidRequest);
  const authority = /^https?:\/\/([^/]+)/i.exec(value)?.[1];
  const url = new URL(value);
  if (
    !authority ||
    authority.includes('@') ||
    url.username ||
    url.password ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && /^(127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(authority)))
  ) {
    throw new Failure(KINDS.invalidRequest);
  }
  return url.href;
}
function validToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= LINGVA_GUARDED_APPROVAL_HTTP_TOKEN_MAX_BYTES &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
  );
}
function discard(body: ReadableStream<Uint8Array> | null): void {
  try {
    void body?.cancel().catch(() => {});
  } catch {
    /* Untrusted cleanup cannot escape or block. */
  }
}
function statusKind(status: number): LingvaGuardedApprovalHttpErrorKind {
  if (status === 400 || status === 413) return KINDS.invalidRequest;
  if (status === 401) return KINDS.unauthenticated;
  if (status === 403) return KINDS.forbidden;
  if (status === 404) return KINDS.notFound;
  if (status === 409) return KINDS.conflict;
  if (status >= 500 && status <= 599) return KINDS.unavailable;
  return KINDS.invalidResponse;
}
function attempt(timeoutMs: number, caller?: AbortSignal) {
  const controller = new AbortController();
  const deadline = performance.now() + timeoutMs;
  let open = true;
  let interrupted = false;
  let reject!: (reason: Failure) => void;
  const interruption = new Promise<never>((_, no) => {
    reject = no;
  });
  // Pre-aborted calls can fail before their first race attaches.
  void interruption.catch(() => {});
  const abort = () => {
    if (!open || interrupted) return;
    interrupted = true;
    controller.abort();
    reject(new Failure(KINDS.transport));
  };
  const timer = setTimeout(abort, timeoutMs);
  caller?.addEventListener('abort', abort, { once: true });
  function check() {
    if (caller?.aborted || performance.now() >= deadline) abort();
    if (interrupted) throw new Failure(KINDS.transport);
  }
  return {
    signal: controller.signal,
    isOpen: () => open && !interrupted,
    check,
    async wait<T>(promise: Promise<T>): Promise<T> {
      check();
      const result = await Promise.race([promise, interruption]);
      check();
      return result;
    },
    close() {
      open = false;
      clearTimeout(timer);
      caller?.removeEventListener('abort', abort);
    },
  };
}
type Attempt = ReturnType<typeof attempt>;
async function readResponse(response: Response, active: Attempt): Promise<unknown> {
  if (!response.body) throw new Failure(KINDS.invalidResponse);
  const reader = response.body.getReader();
  const buffer = new Uint8Array(LINGVA_GUARDED_APPROVAL_RESPONSE_MAX_BYTES);
  let length = 0;
  let complete = false;
  try {
    while (true) {
      // Also checks elapsed time when immediate/empty chunks starve the timer queue.
      active.check();
      const chunk = await active.wait(reader.read());
      if (chunk.done) {
        complete = true;
        break;
      }
      if (!(chunk.value instanceof Uint8Array) || chunk.value.byteLength > buffer.byteLength - length) {
        throw new Failure(KINDS.invalidResponse);
      }
      buffer.set(chunk.value, length);
      length += chunk.value.byteLength;
    }
    try {
      const result: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length)));
      active.check();
      return result;
    } catch (error) {
      if (error instanceof Failure) throw error;
      throw new Failure(KINDS.invalidResponse);
    }
  } finally {
    if (!complete) {
      try {
        void reader.cancel().catch(() => {});
      } catch {
        /* Do not await cleanup. */
      }
    }
    try {
      reader.releaseLock();
    } catch {
      /* A broken injected stream cannot leak a raw exception. */
    }
  }
}

export function createLingvaGuardedApprovalHttpClient(
  options: LingvaGuardedApprovalHttpOptions
): LingvaGuardedApprovalHttpClient {
  let endpoint: string,
    getBearerToken: LingvaGuardedApprovalHttpOptions['getBearerToken'],
    fetcher: typeof fetch,
    timeoutMs: number;
  try {
    endpoint = endpointUrl(options.endpoint);
    getBearerToken = options.getBearerToken;
    fetcher = options.fetcher ?? globalThis.fetch;
    timeoutMs = options.timeoutMs ?? LINGVA_GUARDED_APPROVAL_HTTP_TIMEOUT_MS;
    if (
      typeof getBearerToken !== 'function' ||
      typeof fetcher !== 'function' ||
      !Number.isInteger(timeoutMs) ||
      timeoutMs < 1 ||
      timeoutMs > LINGVA_GUARDED_APPROVAL_HTTP_TIMEOUT_MS
    ) {
      throw new Failure(KINDS.invalidRequest);
    }
  } catch {
    throw new LingvaGuardedApprovalHttpError(KINDS.invalidRequest, 'local', 'none');
  }

  async function invoke<T>(
    build: () => { body: string; parse: (value: unknown) => T | null },
    recovery: LingvaGuardedApprovalHttpRecovery,
    callOptions?: LingvaGuardedApprovalHttpCallOptions
  ): Promise<T> {
    let phase: LingvaGuardedApprovalHttpPhase = 'local';
    let active: Attempt | undefined;
    let response: Response | undefined;
    try {
      let captured: ReturnType<typeof build>;
      try {
        captured = build();
      } catch {
        throw new Failure(KINDS.invalidRequest);
      }
      active = attempt(timeoutMs, callOptions?.signal);
      active.check();
      let token: unknown;
      try {
        token = await active.wait(Promise.resolve(getBearerToken(active.signal)));
      } catch (error) {
        if (error instanceof Failure) throw error;
        throw new Failure(KINDS.unavailable);
      }
      if (!validToken(token)) throw new Failure(KINDS.invalidRequest);
      active.check();
      phase = 'request';
      const current = active;
      // Race the dependency, then dispose a response arriving after the application deadline.
      const pending = Promise.resolve(
        fetcher(endpoint, {
          method: LINGVA_HTTP_METHODS.post,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: captured.body,
          signal: active.signal,
          redirect: 'error',
          credentials: 'omit',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
        })
      ).then((value) => {
        if (!current.isOpen()) discard(value.body);
        return value;
      });
      token = undefined;
      response = await active.wait(pending);
      if (response.status < 200 || response.status >= 300)
        throw new Failure(statusKind(response.status), response.status);
      const raw = await readResponse(response, active);
      const result = captured.parse(raw);
      active.check();
      if (!result) throw new Failure(KINDS.invalidResponse);
      return result;
    } catch (error) {
      const safe =
        error instanceof Failure ? error : new Failure(phase === 'local' ? KINDS.invalidRequest : KINDS.transport);
      throw new LingvaGuardedApprovalHttpError(safe.kind, phase, recovery, safe.status);
    } finally {
      active?.close();
      // readResponse owns acquired readers; this covers errors before reader acquisition.
      if (response?.body && !response.body.locked) discard(response.body);
    }
  }
  return {
    getContext(input, callOptions) {
      return invoke(
        () => {
          const payload = createLingvaGuardedApprovalContextPayload(input);
          return {
            body: JSON.stringify(payload),
            parse: (value) => parseLingvaGuardedApprovalContextResponse(value, payload),
          };
        },
        'none',
        callOptions
      );
    },
    approve(input, callOptions) {
      return invoke(
        () => {
          const payload = createLingvaGuardedApprovalPayload(input);
          return {
            body: JSON.stringify(payload),
            parse: (value) => parseLingvaGuardedApprovalResponse(value, payload.operationId),
          };
        },
        'keep-command',
        callOptions
      );
    },
  };
}
