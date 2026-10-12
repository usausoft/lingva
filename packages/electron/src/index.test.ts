import test from 'node:test';
import assert from 'node:assert/strict';
import { createLingvaElectronRuntime } from './index';

test('createLingvaElectronRuntime exposes the JS runtime contract', () => {
  const runtime = createLingvaElectronRuntime({
    locale: 'en',
    fallbackLocale: 'en',
    resources: {
      en: {
        shell: {
          title: 'Lingva desktop',
          action: [
            { id: 'warm', text: 'Open gently', tone: 'warm' },
            { id: 'bold', text: 'Open now', tone: 'direct' },
          ],
        },
      },
    },
  });

  assert.equal(runtime.tSync('shell.title'), 'Lingva desktop');
  assert.equal(runtime.tSync('shell.action', { variant: 'bold' }), 'Open now');
  assert.equal(runtime.tSync('shell.action', { variant: { tone: 'warm' } }), 'Open gently');
});
