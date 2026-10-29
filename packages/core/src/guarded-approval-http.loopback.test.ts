/** Owned transport simulation only; receipt behavior here does not prove server/database atomicity. */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createLingvaGuardedApprovalHttpClient, LingvaGuardedApprovalHttpError } from './guarded-approval-http';

const scope = {
  projectId: 'synthetic_project',
  environment: 'dev',
  locator: {
    entityKey: 'authoring#dev#fr#hello#draft_one',
    draftId: 'draft_one',
    key: 'hello',
    locale: 'fr',
  },
};
const command = { ...scope, contextToken: 'a'.repeat(64), operationId: '11111111-1111-4111-8111-111111111111' };
const acknowledgment = {
  ok: true,
  result: {
    operationId: command.operationId,
    reviewRevision: 1,
    outcome: 'approved',
    approvedAt: '2026-10-29T12:00:00Z',
  },
};
const cleanup: (() => Promise<void>)[] = [];
async function server(handler: (request: IncomingMessage, response: ServerResponse) => void) {
  const owned = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    owned.once('error', reject);
    owned.listen(0, '127.0.0.1', resolve);
  });
  cleanup.push(
    () =>
      new Promise<void>((resolve, reject) => {
        owned.closeAllConnections();
        owned.close((error) => (error ? reject(error) : resolve()));
      })
  );
  const address = owned.address();
  if (!address || typeof address === 'string') throw new Error('Owned server has no port.');
  return `http://127.0.0.1:${address.port}`;
}
async function body(request: IncomingMessage) {
  let result = '';
  for await (const chunk of request) result += String(chunk);
  return result;
}
function json(response: ServerResponse, value: unknown) {
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(value));
}
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

describe('default Fetch owned-loopback contracts', () => {
  it('sends exact context and approval wire with explicit credentials only', async () => {
    const observed: {
      body: string;
      authorization: string | undefined;
      cookie: string | undefined;
      method: string | undefined;
    }[] = [];
    const endpoint = await server((request, response) => {
      void (async () => {
        const text = await body(request);
        observed.push({
          body: text,
          authorization: request.headers.authorization,
          cookie: request.headers.cookie,
          method: request.method,
        });
        if (JSON.parse(text).action === 'review-context')
          json(response, {
            ok: true,
            context: {
              ...scope,
              actorId: 'synthetic_actor',
              contextToken: command.contextToken,
              isCurrent: true,
              draft: { value: 'Bonjour', status: 'draft' },
              review: { revision: 0 },
              baseline: null,
              permissions: { comment: true, assign: false, decide: true },
            },
          });
        else json(response, acknowledgment);
      })();
    });
    const api = createLingvaGuardedApprovalHttpClient({
      endpoint,
      getBearerToken: () => 'synthetic.payload.signature',
    });
    expect((await api.getContext(scope)).context.locator).toEqual(scope.locator);
    expect(await api.approve(command)).toEqual(acknowledgment);
    expect(observed.map((row) => JSON.parse(row.body))).toEqual([
      { action: 'review-context', ...scope },
      { action: 'review-mutate', command: 'approve', ...command },
    ]);
    expect(
      observed.every(
        (row) =>
          row.authorization === 'Bearer synthetic.payload.signature' &&
          row.cookie === undefined &&
          row.method === 'POST'
      )
    ).toBe(true);
  });
  it.each([301, 302, 303, 307, 308])('never reaches redirect destination for HTTP%s', async (status) => {
    let destinationHits = 0;
    let sourceHits = 0;
    const target = await server((_, response) => {
      destinationHits++;
      json(response, acknowledgment);
    });
    const source = await server((_, response) => {
      sourceHits++;
      response.writeHead(status, { Location: target });
      response.end('server-text');
    });
    const api = createLingvaGuardedApprovalHttpClient({
      endpoint: source,
      getBearerToken: () => 'synthetic.payload.signature',
    });
    await expect(api.approve(command)).rejects.toMatchObject({
      kind: 'transport',
      phase: 'request',
      recovery: 'keep-command',
    });
    expect(sourceHits).toBe(1);
    expect(destinationHits).toBe(0);
  });
  it('bounds a real Fetch body after headers have arrived', async () => {
    let hits = 0;
    const endpoint = await server((_, response) => {
      hits++;
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.write('{');
    });
    const api = createLingvaGuardedApprovalHttpClient({
      endpoint,
      timeoutMs: 100,
      getBearerToken: () => 'synthetic.payload.signature',
    });
    await expect(api.approve(command)).rejects.toMatchObject({
      kind: 'transport',
      phase: 'request',
      recovery: 'keep-command',
    });
    expect(hits).toBe(1);
  });
  it('retains uncertain intent through401/403/409 and explicit rotated-credential recovery', async () => {
    // Deliberate fixture: simulate one stored receipt and a lost acknowledgment, not a database owner.
    const receipts = new Map<string, typeof acknowledgment>();
    const bodies: string[] = [];
    const tokens: string[] = [];
    const denials = [401, 403, 409];
    let commits = 0;
    const endpoint = await server((request, response) => {
      void (async () => {
        const text = await body(request);
        bodies.push(text);
        tokens.push(request.headers.authorization ?? '');
        if (bodies.length === 1) {
          receipts.set(command.operationId, acknowledgment);
          commits++;
          response.destroy();
          return;
        }
        const status = denials.shift();
        if (status) {
          response.writeHead(status);
          response.end('secret server-text');
          return;
        }
        json(response, receipts.get(command.operationId));
      })();
    });
    let token = 'initial.payload.signature';
    const api = createLingvaGuardedApprovalHttpClient({ endpoint, getBearerToken: () => token });
    const captured = structuredClone(command);
    await expect(api.approve(captured)).rejects.toMatchObject({ kind: 'transport', recovery: 'keep-command' });
    expect(bodies).toHaveLength(1);
    token = 'invalid';
    await expect(api.approve(captured)).rejects.toMatchObject({
      phase: 'local',
      recovery: 'keep-command',
      kind: 'invalid-request',
    });
    expect(bodies).toHaveLength(1);
    for (const [index, kind] of ['unauthenticated', 'forbidden', 'conflict'].entries()) {
      token = `rotated${index}.payload.signature`;
      const error = await api.approve(captured).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(LingvaGuardedApprovalHttpError);
      expect(error).toMatchObject({ kind, phase: 'request', recovery: 'keep-command' });
      expect(captured).toEqual(command);
      expect(bodies).toHaveLength(index + 2);
    }
    token = 'final.payload.signature';
    expect(await api.approve(captured)).toEqual(acknowledgment);
    expect(commits).toBe(1);
    expect(receipts.size).toBe(1);
    expect(bodies).toHaveLength(5);
    expect(new Set(bodies).size).toBe(1);
    expect(new Set(tokens).size).toBe(5);
    expect(JSON.parse(bodies[0]!)).toEqual({ action: 'review-mutate', command: 'approve', ...command });
  });
});
