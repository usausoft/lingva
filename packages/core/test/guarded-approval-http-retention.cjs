'use strict';
// Separate process enables deterministic forced-GC assertions without changing the test runner.
const assert = require('node:assert/strict');
module.exports = async function verifyRetention(core) {
  const refs = [];
  const controller = new AbortController();
  let ready;
  const stalled = new Promise((resolve) => {
    ready = resolve;
  });
  let count = 0;
  const body = new ReadableStream({
    pull(stream) {
      if (count++ >= 10000) {
        ready();
        return new Promise(() => {});
      }
      const chunk = new Uint8Array();
      refs.push(new WeakRef(chunk));
      stream.enqueue(chunk);
    },
  });
  const api = core.createLingvaGuardedApprovalHttpClient({
    endpoint: 'https://example.invalid/review',
    getBearerToken: () => 'synthetic.payload.signature',
    fetcher: async () => new Response(body),
  });
  const scope = {
    projectId: 'synthetic_project',
    environment: 'dev',
    locator: { entityKey: 'authoring#dev#fr#hello#draft_one', draftId: 'draft_one', key: 'hello', locale: 'fr' },
  };
  const pending = api.getContext(scope, { signal: controller.signal }).catch((error) => error);
  await stalled;
  await new Promise((resolve) => setImmediate(resolve));
  global.gc();
  const retained = refs.filter((ref) => ref.deref() !== undefined).length;
  controller.abort();
  await pending;
  assert.ok(retained <= 2, `Settled empty chunks retained: ${retained}`);
};
