'use strict';
const assert = require('node:assert/strict');
module.exports = async function verifyAbortEntry(core, stage) {
  const errors = [];
  const onUnhandled = (error) => errors.push(error);
  process.on('unhandledRejection', onUnhandled);
  try {
    const controller = new AbortController();
    const api = core.createLingvaGuardedApprovalHttpClient({
      endpoint: 'https://example.invalid/review',
      getBearerToken: () => {
        if (stage === 'token') {
          controller.abort();
          return Promise.reject(new Error('sensitive dependency rejection'));
        }
        return 'synthetic.payload.signature';
      },
      fetcher: () => {
        controller.abort();
        return Promise.reject(new Error('sensitive dependency rejection'));
      },
    });
    const scope = {
      projectId: 'synthetic_project',
      environment: 'dev',
      locator: { entityKey: 'authoring#dev#fr#hello#draft_one', draftId: 'draft_one', key: 'hello', locale: 'fr' },
    };
    await assert.rejects(api.getContext(scope, { signal: controller.signal }), (error) => error.kind === 'transport');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(errors.length, 0, 'Dependency cancellation leaked an unhandled rejection.');
  } finally {
    process.removeListener('unhandledRejection', onUnhandled);
  }
};
