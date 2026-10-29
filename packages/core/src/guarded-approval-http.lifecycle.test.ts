import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import {
  createLingvaGuardedApprovalHttpClient as create,
  LingvaGuardedApprovalHttpError,
} from './guarded-approval-http';
const scope = {
  projectId: 'synthetic_project',
  environment: 'dev',
  locator: { entityKey: 'authoring#dev#fr#hello#draft_one', draftId: 'draft_one', key: 'hello', locale: 'fr' },
};
const command = { ...scope, contextToken: 'a'.repeat(64), operationId: '11111111-1111-4111-8111-111111111111' };
const ack = {
  ok: true,
  result: {
    operationId: command.operationId,
    reviewRevision: 1,
    outcome: 'approved',
    approvedAt: '2026-10-29T12:00:00Z',
  },
};
const config = { endpoint: 'https://example.invalid/review', getBearerToken: () => 'synthetic.payload.signature' };
const execute = promisify(execFile);
describe('guarded HTTP lifecycle regressions', () => {
  it('does not retain settled empty chunks while the current read stalls', async () => {
    const result = await execute(
      process.execPath,
      ['--expose-gc', 'test/guarded-approval-http-subprocess.cjs', 'retention'],
      { cwd: process.cwd(), timeout: 10000 }
    );
    expect(result.stderr).toBe('');
  });
  it.each(['token', 'fetch'])(
    'handles a rejecting %s promise even when dependency entry aborts synchronously',
    async (stage) => {
      const result = await execute(process.execPath, ['test/guarded-approval-http-subprocess.cjs', stage], {
        cwd: process.cwd(),
        timeout: 10000,
      });
      expect(result.stderr).toBe('');
    }
  );
  it('disposes a response fulfilled immediately before caller cancellation', async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    const api = create({
      ...config,
      fetcher: () => {
        const response = Promise.resolve(new Response(body));
        void response.then(() => {
          queueMicrotask(() => controller.abort());
        });
        return response;
      },
    });
    await expect(api.approve(command, { signal: controller.signal })).rejects.toMatchObject({
      kind: 'transport',
      recovery: 'keep-command',
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
  });
  it('never lets a throwing Response body getter replace classified errors', async () => {
    const sensitive = new LingvaGuardedApprovalHttpError('forbidden', 'local', 'none', 403);
    sensitive.message = 'sensitive dependency text';
    class ThrowingResponse extends Response {
      override get body(): ReadableStream<Uint8Array> | null {
        throw sensitive;
      }
    }
    const api = create({ ...config, fetcher: async () => new ThrowingResponse('{}') });
    const error = await api.approve(command).catch((error: unknown) => error);
    expect(error).not.toBe(sensitive);
    expect(error).toMatchObject({
      kind: 'transport',
      phase: 'request',
      recovery: 'keep-command',
      message: 'Guarded approval transport failed.',
    });
  });
  it('does not let throwing signal cleanup replace success or static failure', async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener').mockImplementation(() => {
      throw new Error('sensitive cleanup');
    });
    try {
      await expect(
        create({ ...config, fetcher: async () => Response.json(ack) }).approve(command, { signal: controller.signal })
      ).resolves.toEqual(ack);
      await expect(
        create({ ...config, fetcher: async () => new Response(null, { status: 401 }) }).approve(command, {
          signal: controller.signal,
        })
      ).rejects.toMatchObject({ kind: 'unauthenticated', recovery: 'keep-command' });
    } finally {
      remove.mockRestore();
    }
  });
  it('accepts a valid Uint8Array chunk from another JavaScript realm', async () => {
    const data = new TextEncoder().encode(JSON.stringify(ack));
    const foreign = runInNewContext('new Uint8Array(bytes)', { bytes: [...data] }) as Uint8Array;
    expect(foreign instanceof Uint8Array).toBe(false);
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(foreign);
        controller.close();
      },
    });
    await expect(create({ ...config, fetcher: async () => new Response(body) }).approve(command)).resolves.toEqual(ack);
  });
});
