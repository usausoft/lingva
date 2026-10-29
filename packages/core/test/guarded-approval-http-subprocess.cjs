'use strict';
const assert = require('node:assert/strict');

async function main(stage) {
  // Load current source with the same declared transformer as Vitest. Never rebuild shared dist
  // while workspace consumers are compiling against it; protected package checks run separately.
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true },
  });
  try {
    assert.equal(server.httpServer, null);
    const core = await server.ssrLoadModule('/src/guarded-approval-http.ts');
    if (stage === 'retention') await require('./guarded-approval-http-retention.cjs')(core);
    else await require('./guarded-approval-http-abort-entry.cjs')(core, stage);
  } finally {
    await server.close();
  }
}
void main(process.argv[2]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
