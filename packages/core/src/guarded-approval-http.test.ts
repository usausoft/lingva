import { afterEach, describe, expect, it, vi } from 'vitest';
import * as core from './index';
import type { LingvaGuardedApprovalHttpOptions } from './index';

const scope = () => ({
  projectId: 'synthetic_project',
  environment: 'dev',
  locator: {
    entityKey: 'authoring#dev#fr#hello#draft_one',
    draftId: 'draft_one',
    key: 'hello',
    locale: 'fr',
    variantId: 'formal',
  },
});
const operationId = '11111111-1111-4111-8111-111111111111';
const command = () => ({ ...scope(), contextToken: 'a'.repeat(64), operationId });
const jwt = 'synthetic.payload.signature';
const ack = () => ({
  ok: true,
  result: { operationId, reviewRevision: 1, outcome: 'approved', approvedAt: '2026-10-29T12:00:00Z' },
});
const context = () => ({
  ok: true,
  context: {
    ...scope(),
    actorId: 'synthetic_actor',
    contextToken: 'a'.repeat(64),
    isCurrent: true,
    draft: {
      value: 'Bonjour 🌍',
      status: 'approved',
      authorId: 'author',
      approvedBy: 'reviewer',
      approvedAt: '2026-10-29T12:00:00Z',
    },
    review: { revision: 1, assigneeId: 'reviewer', outcome: 'approved' },
    baseline: { revision: 'r1', publishId: 'p1' },
    permissions: { comment: true, assign: false, decide: true },
  },
});
function client(options: Partial<LingvaGuardedApprovalHttpOptions> = {}) {
  expect(core.createLingvaGuardedApprovalHttpClient).toBeTypeOf('function');
  return core.createLingvaGuardedApprovalHttpClient({
    endpoint: 'https://example.invalid/review',
    getBearerToken: () => jwt,
    fetcher: vi.fn(async () => Response.json(ack())),
    ...options,
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const bytes = (text: string) => new TextEncoder().encode(text);
function streamed(chunks: Uint8Array[], headers?: HeadersInit) {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const part of chunks) c.enqueue(part);
      c.close();
    },
    cancel,
  });
  return { response: new Response(body, { headers }), body, cancel };
}
async function failure(
  promise: Promise<unknown>,
  kind: string,
  phase = 'request',
  recovery = 'keep-command',
  status?: number
) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(core.LingvaGuardedApprovalHttpError);
  expect(error).toMatchObject({ kind, phase, recovery, ...(status === undefined ? {} : { status }) });
  expect(Object.keys(error as object).sort()).toEqual(
    ['kind', 'name', 'phase', 'recovery', ...(status === undefined ? [] : ['status'])].sort()
  );
  expect(JSON.stringify(error)).not.toMatch(/example.invalid|synthetic|payload|Bonjour|draft_one|secret|server-text/);
  expect((error as Error).cause).toBeUndefined();
  return error;
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('guarded HTTP wire and captured intent', () => {
  it('exports the named client contract and sends only literal guarded wire and isolated headers', async () => {
    const fetcher = vi.fn(async () => Response.json(ack()));
    expect(await client({ fetcher }).approve(command())).toEqual(ack());
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetcher.mock.calls[0]! as unknown as [string, RequestInit];
    expect(endpoint).toBe('https://example.invalid/review');
    expect(init).toMatchObject({
      method: 'POST',
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: expect.any(AbortSignal),
    });
    expect(init.headers).toEqual({ Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ action: 'review-mutate', command: 'approve', ...command() });
    expect(core.LINGVA_GUARDED_APPROVAL_HTTP_TIMEOUT_MS).toBe(5000);
    expect(core.LINGVA_GUARDED_APPROVAL_HTTP_TOKEN_MAX_BYTES).toBe(16384);
    expect(Object.values(core.LINGVA_GUARDED_APPROVAL_HTTP_ERROR_KINDS)).toEqual([
      'invalid-request',
      'unauthenticated',
      'forbidden',
      'not-found',
      'conflict',
      'unavailable',
      'transport',
      'invalid-response',
    ]);
  });
  it('projects context optional facts and snapshots scope/config before credentials resolve', async () => {
    const token = deferred<string>();
    const input = scope();
    const original = scope();
    const observed = context();
    (observed.context as unknown as Record<string, unknown>).secret = 'discard';
    const fetcher = vi.fn(async () => Response.json(observed));
    const options = { endpoint: 'https://example.invalid/review', getBearerToken: () => token.promise, fetcher };
    const api = client(options);
    const pending = api.getContext(input);
    input.locator.variantId = 'changed';
    input.projectId = 'changed';
    options.endpoint = 'https://changed.invalid';
    options.getBearerToken = () => Promise.reject('secret');
    options.fetcher = vi.fn(async () => {
      throw new Error('secret');
    });
    token.resolve(jwt);
    expect(await pending).toEqual(context());
    expect(fetcher.mock.calls[0]![0]).toBe('https://example.invalid/review');
    expect(JSON.parse((fetcher.mock.calls[0]![1] as RequestInit).body as string)).toEqual({
      action: 'review-context',
      ...original,
    });
    expect(Object.isFrozen(input)).toBe(false);
  });
  it('captures complete command/UUID before an await without mutating caller input', async () => {
    const token = deferred<string>();
    const input = command();
    const original = command();
    const fetcher = vi.fn(async () => Response.json(ack()));
    const pending = client({ getBearerToken: () => token.promise, fetcher }).approve(input);
    input.operationId = '22222222-2222-4222-8222-222222222222';
    input.contextToken = 'b'.repeat(64);
    input.locator.key = 'changed';
    token.resolve(jwt);
    expect(await pending).toEqual(ack());
    expect(JSON.parse((fetcher.mock.calls[0]![1] as RequestInit).body as string)).toEqual({
      action: 'review-mutate',
      command: 'approve',
      ...original,
    });
    expect(Object.isFrozen(input.locator)).toBe(false);
  });
  it.each([
    'http://example.invalid',
    '/relative',
    'https://user:pass@example.invalid',
    'https://@example.invalid',
    'https://example.invalid?',
    'https://example.invalid#',
    'https://example.invalid?q=x',
    'ftp://example.invalid',
    'http://localhost:1234',
    'http://127.1:1234',
    'http://2130706433:1234',
  ])('rejects endpoint %s', (endpoint) => {
    expect(() => client({ endpoint })).toThrow('Invalid guarded approval request.');
  });
  it.each(['http://127.0.0.1:1234/review', 'http://[::1]:1234/review', 'https://example.invalid/review'])(
    'allows explicit endpoint %s',
    (endpoint) => {
      expect(client({ endpoint })).toBeDefined();
    }
  );
  it.each([0, 5001, 1.5, NaN, Infinity])('rejects invalid timeout %s', (timeoutMs) => {
    expect(() => client({ timeoutMs })).toThrow('Invalid guarded approval request.');
  });
  it('rejects invalid input before credentials or Fetch, including credential/actor overrides', async () => {
    const fetcher = vi.fn();
    const getBearerToken = vi.fn(() => jwt);
    const api = client({ fetcher, getBearerToken });
    for (const input of [
      { ...command(), operationId: 'bad' },
      { ...command(), actorId: 'secret' },
      { ...command(), locator: { ...scope().locator, variantId: '' } },
      { ...command(), projectId: 'x'.repeat(201) },
      { ...command(), token: jwt },
    ]) {
      await failure(api.approve(input), 'invalid-request', 'local');
    }
    await failure(api.getContext({ ...scope(), environment: 'not valid' }), 'invalid-request', 'local', 'none');
    expect(getBearerToken).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    '',
    `Bearer ${jwt}`,
    'a.b',
    'a..c',
    'a.b.c.d',
    'a.b.c\n',
    'a. b.c',
    'a.b.é',
    'a.b.\0',
    `${'a'.repeat(16381)}.b.c`,
  ])('rejects malformed credentials locally (%#)', async (token) => {
    const fetcher = vi.fn();
    await failure(client({ getBearerToken: () => token, fetcher }).approve(command()), 'invalid-request', 'local');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('allows exactly16KiB shape without treating it as identity proof', async () => {
    const token = `${'a'.repeat(16380)}.b.c`;
    const fetcher = vi.fn(async () => Response.json(ack()));
    await client({ getBearerToken: () => token, fetcher }).approve(command());
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('sanitized static failures and recovery', () => {
  it.each([
    [400, 'invalid-request'],
    [413, 'invalid-request'],
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [409, 'conflict'],
    [500, 'unavailable'],
    [503, 'unavailable'],
    [302, 'invalid-response'],
    [429, 'invalid-response'],
  ])('maps HTTP%s without reading its body', async (status, kind) => {
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    const fetcher = vi.fn(
      async () => new Response(body, { status: status as number, headers: { 'X-Secret': 'server-text' } })
    );
    await failure(client({ fetcher }).approve(command()), kind as string, 'request', 'keep-command', status as number);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('sanitizes callback errors and fake public errors instead of trusting them', async () => {
    await failure(
      client({
        getBearerToken: () => {
          throw new Error('secret server-text');
        },
      }).approve(command()),
      'unavailable',
      'local'
    );
    const error = new core.LingvaGuardedApprovalHttpError('forbidden', 'local', 'none', 403);
    error.message = 'secret server-text';
    await failure(
      client({
        fetcher: async () => {
          throw error;
        },
      }).approve(command()),
      'transport'
    );
    await failure(
      client({
        getBearerToken: () => {
          throw error;
        },
      }).getContext(scope()),
      'unavailable',
      'local',
      'none'
    );
  });
  it('uses static kind-specific messages with no attached external exception', async () => {
    const error = await failure(
      client({
        fetcher: async () => {
          throw 'secret';
        },
      }).approve(command()),
      'transport'
    );
    expect((error as Error).message).toBe('Guarded approval transport failed.');
    expect((error as Error).stack).not.toContain('secret');
  });
});

describe('bounded strict streamed observations', () => {
  it('accepts exact128KiB and rejects the next actual byte despite lying content length', async () => {
    const base = JSON.stringify({ ...ack(), padding: '' });
    const text = JSON.stringify({ ...ack(), padding: 'x'.repeat(131072 - bytes(base).length) });
    expect(bytes(text).length).toBe(131072);
    const exact = streamed([bytes(text)], { 'Content-Length': '1' });
    expect(await client({ fetcher: async () => exact.response }).approve(command())).toEqual(ack());
    expect(exact.body.locked).toBe(false);
    const tooLarge = streamed([bytes(text), bytes(' ')], { 'Content-Length': '1' });
    await failure(client({ fetcher: async () => tooLarge.response }).approve(command()), 'invalid-response');
    expect(tooLarge.body.locked).toBe(false);
  });
  it('decodes split multibyte chunks and projects known fields without content length', async () => {
    const data = bytes(JSON.stringify({ ...context(), secret: 'discard' }));
    const split = Array.from(data, (byte) => new Uint8Array([byte]));
    const result = await client({ fetcher: async () => streamed(split).response }).getContext(scope());
    expect(result).toEqual(context());
  });
  it.each([
    'invalid-utf8',
    'invalid-json',
    'missing-body',
    'wrong-uuid',
    'legacy-success',
    'wrong-scope',
    'wrong-variant',
    'inconsistent',
  ])('rejects %s success', async (kind) => {
    let response: Response;
    if (kind === 'invalid-utf8') response = streamed([new Uint8Array([0xff])]).response;
    else if (kind === 'invalid-json') response = new Response('{');
    else if (kind === 'missing-body') response = new Response(null);
    else if (kind === 'wrong-uuid')
      response = Response.json({
        ...ack(),
        result: { ...ack().result, operationId: '22222222-2222-4222-8222-222222222222' },
      });
    else if (kind === 'legacy-success') response = Response.json({ ok: true, draftId: 'draft_one' });
    else {
      const value = context();
      if (kind === 'wrong-scope') value.context.projectId = 'other';
      else if (kind === 'wrong-variant') value.context.locator.variantId = 'other';
      else value.context.isCurrent = false;
      response = Response.json(value);
    }
    const api = client({ fetcher: async () => response });
    await failure(
      kind.startsWith('wrong-scope') || kind === 'wrong-variant' || kind === 'inconsistent'
        ? api.getContext(scope())
        : api.approve(command()),
      'invalid-response',
      'request',
      ['wrong-scope', 'wrong-variant', 'inconsistent'].includes(kind) ? 'none' : 'keep-command'
    );
  });
  it('cancels and releases an overflowing reader even when cancellation never settles', async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const body = new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(131073));
      },
      cancel,
    });
    await failure(client({ fetcher: async () => new Response(body) }).approve(command()), 'invalid-response');
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
  });
});

describe('one application deadline and abort lifecycle', () => {
  it.each(['token', 'fetch', 'body'])('bounds stalled %s even when dependencies ignore abort', async (stage) => {
    vi.useFakeTimers();
    const token = deferred<string>();
    const fetch = deferred<Response>();
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    const signal = new AbortController();
    const remove = vi.spyOn(signal.signal, 'removeEventListener');
    const fetcher = vi.fn(() => (stage === 'body' ? Promise.resolve(new Response(body)) : fetch.promise));
    const api = client({ timeoutMs: 50, getBearerToken: () => (stage === 'token' ? token.promise : jwt), fetcher });
    const result = failure(
      api.approve(command(), { signal: signal.signal }),
      'transport',
      stage === 'token' ? 'local' : 'request'
    );
    await vi.advanceTimersByTimeAsync(50);
    await result;
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls.length).toBe(stage === 'token' ? 0 : 1);
    if (stage === 'body') {
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(body.locked).toBe(false);
    }
    if (stage === 'token') token.reject('late secret');
    if (stage === 'fetch') fetch.reject('late secret');
    await Promise.resolve();
  });
  it('uses one total budget across credential acquisition and response body', async () => {
    vi.useFakeTimers();
    const token = deferred<string>();
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    const api = client({ timeoutMs: 50, getBearerToken: () => token.promise, fetcher: async () => new Response(body) });
    const result = failure(api.approve(command()), 'transport');
    await vi.advanceTimersByTimeAsync(40);
    token.resolve(jwt);
    await vi.advanceTimersByTimeAsync(10);
    await result;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('pre-abort prevents credentials and Fetch; mid-fetch abort uses request phase', async () => {
    const controller = new AbortController();
    controller.abort('secret');
    const fetcher = vi.fn();
    const token = vi.fn(() => jwt);
    await failure(
      client({ fetcher, getBearerToken: token }).approve(command(), { signal: controller.signal }),
      'transport',
      'local'
    );
    expect(token).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    const live = new AbortController();
    const gate = deferred<Response>();
    const active = vi.fn(() => gate.promise);
    const result = failure(client({ fetcher: active }).approve(command(), { signal: live.signal }), 'transport');
    await vi.waitFor(() => expect(active).toHaveBeenCalledTimes(1));
    live.abort('secret');
    await result;
    gate.reject('late secret');
  });
  it('cancels a response that arrives after deadline and does not retain it', async () => {
    vi.useFakeTimers();
    const fetch = deferred<Response>();
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    const result = failure(client({ timeoutMs: 10, fetcher: () => fetch.promise }).approve(command()), 'transport');
    await vi.advanceTimersByTimeAsync(10);
    await result;
    fetch.resolve(new Response(body));
    await vi.advanceTimersByTimeAsync(0);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
  });
  it('cleans listener/timer on success and aborts a stalled reader on caller cancellation', async () => {
    vi.useFakeTimers();
    const control = new AbortController();
    const remove = vi.spyOn(control.signal, 'removeEventListener');
    await client().approve(command(), { signal: control.signal });
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledTimes(1);
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    const next = new AbortController();
    const result = failure(
      client({ fetcher: async () => new Response(body) }).approve(command(), { signal: next.signal }),
      'transport'
    );
    await vi.advanceTimersByTimeAsync(0);
    next.abort();
    await result;
    expect(body.locked).toBe(false);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('enforces elapsed deadline across an unending series of empty chunks', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      pull(c) {
        c.enqueue(new Uint8Array());
      },
      cancel,
    });
    await failure(client({ timeoutMs: 5, fetcher: async () => new Response(body) }).approve(command()), 'transport');
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
  });
});
