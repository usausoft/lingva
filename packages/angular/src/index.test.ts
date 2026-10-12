import assert from 'node:assert/strict';
import test from 'node:test';
import { createLingvaResources, defineLingvaProject } from '@lingva/core';
import { createLingvaAngular, createLingvaAngularServer } from './index';

const resources = createLingvaResources({
  en: {
    title: 'Lingva',
    action: [
      { id: 'warm', text: 'Continue gently', tone: 'warm' },
      { id: 'bold', text: 'Continue now', tone: 'direct' },
    ],
  },
  ru: { title: 'Лингва' },
});

test('Angular adapter exposes typed translations through signals', async () => {
  const lingva = createLingvaAngular<typeof resources>({
    project: defineLingvaProject({ resources, defaultLocale: 'en' }),
    locale: 'en',
  });

  assert.equal(lingva.t('title'), 'Lingva');
  assert.equal(lingva.t('action', { variant: 'bold' }), 'Continue now');
  assert.equal(lingva.t('action', { variant: { tone: 'warm' } }), 'Continue gently');
  await lingva.setLocale('ru');
  assert.equal(lingva.locale(), 'ru');
  assert.equal(lingva.t('title'), 'Лингва');
  lingva.runtime.destroy();
});

test('Angular adapter handles hosted hydration, failures, and stale locale cancellation', async () => {
  const lingva = createLingvaAngular({
    mode: 'remote',
    locale: 'en',
    remote: { url: 'https://delivery.lingva.test/{locale}.json' },
    fetcher: async (input, init) => {
      const url = String(input);
      if (url.includes('/slow.')) {
        await new Promise<void>((resolve) => init?.signal?.addEventListener('abort', () => resolve(), { once: true }));
      }
      if (url.includes('/error.')) throw new Error('Delivery unavailable');
      return new Response(JSON.stringify({ title: url.includes('/ru.') ? 'Удалённая Лингва' : 'Remote Lingva' }));
    },
  });

  await lingva.ready;
  assert.equal(lingva.t('title'), 'Remote Lingva');
  const staleLoad = lingva.setLocale('slow');
  await lingva.setLocale('ru');
  await staleLoad;
  assert.equal(lingva.locale(), 'ru');
  assert.equal(lingva.t('title'), 'Удалённая Лингва');
  await assert.rejects(() => lingva.setLocale('error'), /Delivery unavailable/);
  assert.match(lingva.error()?.message ?? '', /Delivery unavailable/);
  lingva.runtime.destroy();
});

test('Angular server adapters isolate parallel SSR request locales', async () => {
  const fetcher = async (input: string | URL | Request) => {
    const locale = String(input).includes('/ru.') ? 'ru' : 'en';
    return new Response(JSON.stringify({ title: locale === 'ru' ? 'Серверная Лингва' : 'Server Lingva' }));
  };
  const createRequestAdapter = (locale: 'en' | 'ru') =>
    createLingvaAngularServer(
      {
        mode: 'remote',
        locale,
        remote: { url: 'https://delivery.lingva.test/{locale}.json' },
      },
      { fetcher }
    );

  const [english, russian] = await Promise.all([createRequestAdapter('en'), createRequestAdapter('ru')]);
  assert.equal(english.t('title'), 'Server Lingva');
  assert.equal(russian.t('title'), 'Серверная Лингва');
  assert.equal(english.locale(), 'en');
  assert.equal(russian.locale(), 'ru');
  english.runtime.destroy();
  russian.runtime.destroy();
});

test('Angular server adapter fails initial rendering when delivery fails', async () => {
  await assert.rejects(
    () =>
      createLingvaAngularServer(
        {
          mode: 'remote',
          locale: 'en',
          remote: { url: 'https://delivery.lingva.test/{locale}.json' },
        },
        { fetcher: async () => Promise.reject(new Error('SSR delivery unavailable')) }
      ),
    /SSR delivery unavailable/
  );
});
