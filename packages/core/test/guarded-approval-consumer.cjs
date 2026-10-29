'use strict';

const assert = require('node:assert/strict');

module.exports = function verifyGuardedApproval(core) {
  for (const name of [
    'createLingvaGuardedApprovalContextPayload',
    'createLingvaGuardedApprovalPayload',
    'parseLingvaGuardedApprovalContextResponse',
    'parseLingvaGuardedApprovalResponse',
  ])
    assert.equal(typeof core[name], 'function', `Missing packed export ${name}.`);
  const scope = {
    projectId: 'project_demo',
    environment: 'dev',
    locator: {
      entityKey: 'authoring#dev#en#hero.title#draft_one',
      draftId: 'draft_one',
      key: 'hero.title',
      locale: 'en',
    },
  };
  const operationId = '11111111-1111-4111-8111-111111111111';
  assert.deepEqual(core.createLingvaGuardedApprovalContextPayload(scope), {
    action: 'review-context',
    ...scope,
  });
  assert.deepEqual(core.createLingvaGuardedApprovalPayload({ ...scope, contextToken: 'a'.repeat(64), operationId }), {
    action: 'review-mutate',
    command: 'approve',
    ...scope,
    contextToken: 'a'.repeat(64),
    operationId,
  });
  const context = {
    ok: true,
    context: {
      ...scope,
      actorId: 'user_demo',
      contextToken: 'a'.repeat(64),
      isCurrent: true,
      draft: { value: 'Hello', status: 'draft' },
      review: { revision: 0 },
      baseline: null,
      permissions: { comment: true, assign: false, decide: true },
    },
  };
  assert.deepEqual(core.parseLingvaGuardedApprovalContextResponse(context, scope), context);
  const response = {
    ok: true,
    result: { operationId, reviewRevision: 1, outcome: 'approved', approvedAt: '2026-10-29T12:00:00Z' },
  };
  assert.deepEqual(core.parseLingvaGuardedApprovalResponse(response, operationId), response);
  assert.equal(
    core.parseLingvaGuardedApprovalResponse({ ok: true, draftId: 'draft_one', status: 'approved' }, operationId),
    null
  );
};
