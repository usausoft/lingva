'use strict';
const assert = require('node:assert/strict');

module.exports = async function verifyGuardedApprovalHttp(core) {
  assert.equal(typeof core.createLingvaGuardedApprovalHttpClient, 'function', 'Missing packed guarded HTTP export.');
  assert.equal(typeof core.LingvaGuardedApprovalHttpError, 'function');
  assert.equal(core.LINGVA_GUARDED_APPROVAL_HTTP_TIMEOUT_MS, 5000);
  assert.equal(core.LINGVA_GUARDED_APPROVAL_HTTP_TOKEN_MAX_BYTES, 16384);
  const scope = {
    projectId: 'synthetic_project',
    environment: 'dev',
    locator: { entityKey: 'authoring#dev#en#hello#draft_one', draftId: 'draft_one', key: 'hello', locale: 'en' },
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
  const context = {
    ok: true,
    context: {
      ...scope,
      actorId: 'synthetic_actor',
      contextToken: command.contextToken,
      isCurrent: true,
      draft: { value: 'Hello', status: 'draft' },
      review: { revision: 0 },
      baseline: null,
      permissions: { comment: true, assign: false, decide: true },
    },
  };
  const calls = [];
  const api = core.createLingvaGuardedApprovalHttpClient({
    endpoint: 'https://example.invalid/review',
    getBearerToken: () => 'synthetic.payload.signature',
    fetcher: async (_, init) => {
      calls.push(JSON.parse(init.body));
      assert.equal(init.redirect, 'error');
      assert.equal(init.credentials, 'omit');
      return Response.json(calls.at(-1).action === 'review-context' ? context : ack);
    },
  });
  assert.deepEqual(await api.getContext(scope), context);
  assert.deepEqual(await api.approve(command), ack);
  assert.deepEqual(calls, [
    { action: 'review-context', ...scope },
    { action: 'review-mutate', command: 'approve', ...command },
  ]);
  await assert.rejects(api.approve({ ...command, operationId: 'invalid' }), (error) => {
    assert.ok(error instanceof core.LingvaGuardedApprovalHttpError);
    assert.equal(error.kind, 'invalid-request');
    assert.equal(error.phase, 'local');
    assert.equal(error.recovery, 'keep-command');
    assert.equal(error.message, 'Invalid guarded approval request.');
    assert.equal(error.cause, undefined);
    return true;
  });
  assert.equal(calls.length, 2);
};
