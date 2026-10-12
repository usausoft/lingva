import assert from 'node:assert/strict';
import test from 'node:test';
import { createLingvaResources, defineLingvaProject } from '@lingva/core';
import { clearLingvaJsConfiguration, configureLingvaJs, createLingvaJsRuntime } from './index';

const resources = createLingvaResources({
  en: {
    'site.title': 'Lingva Docs',
    'site.tagline': 'Language infrastructure for developers',
    'banner.cta': [
      { id: 'warm', text: 'Start gently', tone: 'warm' },
      { id: 'bold', text: 'Start now', tone: 'direct' },
    ],
  },
  ru: {
    'site.title': 'Документация Lingva',
  },
});

test('createLingvaJsRuntime translates and switches locales', async () => {
  const runtime = createLingvaJsRuntime({
    project: defineLingvaProject({
      resources,
      defaultLocale: 'en',
      fallbackLocale: 'en',
    }),
    locale: 'en',
  });

  assert.equal(runtime.getLocale(), 'en');
  assert.deepEqual(runtime.getAvailableLocales(), ['en', 'ru']);
  assert.equal(runtime.has('site.title'), true);
  assert.equal(runtime.tSync('site.title'), 'Lingva Docs');

  runtime.setLocale('ru');

  assert.equal(runtime.getLocale(), 'ru');
  assert.equal(runtime.has('site.title'), true);
  assert.equal(runtime.has('site.tagline'), false);
  assert.equal(runtime.tSync('site.title'), 'Документация Lingva');
  assert.equal(runtime.tSync('site.tagline'), 'Language infrastructure for developers');
  assert.equal(await runtime.t('site.title'), 'Документация Lingva');
  runtime.setLocale('en');
  assert.equal(runtime.tSync('banner.cta', { variant: 'bold' }), 'Start now');
  assert.equal(runtime.tSync('banner.cta', { variant: { tone: 'warm' } }), 'Start gently');
});

test('createLingvaJsRuntime accepts high-level remote setup', async () => {
  const runtime = createLingvaJsRuntime({
    mode: 'remote',
    apiUrl: 'https://api.lingva.dev',
    locale: 'en',
    fallbackLocale: 'en',
    remote: {
      url: 'https://cdn.lingva.dev/{locale}.json',
    },
    fetcher: async () =>
      new Response(
        JSON.stringify({
          site: {
            title: 'Remote Lingva Docs',
          },
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }
      ),
  });

  await runtime.preload(['site.title']);

  assert.equal(runtime.tSync('site.title'), 'Remote Lingva Docs');
});

test('explicit loader options override high-level remote setup defaults', async () => {
  const runtime = createLingvaJsRuntime(
    {
      mode: 'remote',
      locale: 'en',
      remote: { url: 'https://delivery.lingva.test/{locale}.json' },
    },
    {
      fetcher: async () => new Response(JSON.stringify({ title: 'Injected delivery' })),
    }
  );

  await runtime.loadLocale('en');
  assert.equal(runtime.tSync('title'), 'Injected delivery');
  runtime.destroy();
});

test('createLingvaJsRuntime can use a registered default configuration', () => {
  configureLingvaJs({
    project: defineLingvaProject({
      resources,
      defaultLocale: 'en',
      fallbackLocale: 'en',
    }),
    locale: 'ru',
    fallbackLocale: 'en',
  });

  const runtime = createLingvaJsRuntime();

  assert.equal(runtime.tSync('site.title'), 'Документация Lingva');

  clearLingvaJsConfiguration();
});

test('loadLocale publishes reactive state and hydrates remote resources', async () => {
  const snapshots: Array<{ loading: boolean; locale: string; error?: Error }> = [];
  const runtime = createLingvaJsRuntime({
    mode: 'remote',
    locale: 'en',
    remote: { url: 'https://cdn.lingva.dev/{locale}.json' },
    fetcher: async (input) =>
      new Response(JSON.stringify({ 'site.title': String(input).includes('/ru.') ? 'Лингва' : 'Lingva' })),
  });
  const unsubscribe = runtime.subscribe((snapshot) => snapshots.push(snapshot));

  await runtime.loadLocale('ru');

  assert.equal(runtime.getLocale(), 'ru');
  assert.equal(runtime.tSync('site.title'), 'Лингва');
  assert.deepEqual(
    snapshots.map(({ loading, locale }) => ({ loading, locale })),
    [
      { loading: false, locale: 'en' },
      { loading: true, locale: 'ru' },
      { loading: false, locale: 'ru' },
    ]
  );

  unsubscribe();
  runtime.destroy();
});

test('a newer locale load cancels stale delivery without overwriting state', async () => {
  const runtime = createLingvaJsRuntime({
    mode: 'remote',
    locale: 'en',
    remote: { url: 'https://cdn.lingva.dev/{locale}.json' },
    fetcher: async (input, init) => {
      if (String(input).includes('/ru.')) {
        await new Promise<void>((resolve) => {
          init?.signal?.addEventListener('abort', () => resolve(), { once: true });
        });
      }
      return new Response(JSON.stringify({ 'site.title': 'Lingva' }));
    },
  });

  const staleLoad = runtime.loadLocale('ru');
  await runtime.loadLocale('en');
  await staleLoad;

  assert.deepEqual(runtime.getSnapshot(), { loading: false, locale: 'en' });
  runtime.destroy();
});
