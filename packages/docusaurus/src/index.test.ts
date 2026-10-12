import test from 'node:test';
import assert from 'node:assert/strict';
import { createLingvaDocusaurusRuntime } from './index';

test('createLingvaDocusaurusRuntime exposes the JS runtime contract', () => {
  const runtime = createLingvaDocusaurusRuntime({
    locale: 'en',
    fallbackLocale: 'en',
    resources: {
      en: {
        site: {
          title: 'Lingva docs',
          action: [
            { id: 'warm', text: 'Read gently', tone: 'warm' },
            { id: 'bold', text: 'Read now', tone: 'direct' },
          ],
        },
      },
    },
  });

  assert.equal(runtime.tSync('site.title'), 'Lingva docs');
  assert.equal(runtime.tSync('site.action', { variant: 'bold' }), 'Read now');
  assert.equal(runtime.tSync('site.action', { variant: { tone: 'warm' } }), 'Read gently');
});
