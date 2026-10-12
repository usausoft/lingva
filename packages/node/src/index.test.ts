import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLingvaNodeRuntime,
  createLingvaLocaleContext,
  createLingvaLocaleMiddleware,
  createLingvaNodeFileLoader,
} from './index';

test('createLingvaNodeRuntime translates with inline resources', () => {
  const runtime = createLingvaNodeRuntime({
    locale: 'en',
    fallbackLocale: 'en',
    resources: {
      en: {
        greeting: 'Hello',
        farewell: 'Goodbye',
        action: [
          { id: 'warm', text: 'Continue gently', tone: 'warm' },
          { id: 'bold', text: 'Continue now', tone: 'direct' },
        ],
      },
      fr: {
        greeting: 'Bonjour',
        farewell: 'Au revoir',
      },
    },
  });

  assert.equal(runtime.tSync('greeting'), 'Hello');
  assert.equal(runtime.tSync('action', { variant: 'bold' }), 'Continue now');
  assert.equal(runtime.tSync('action', { variant: { tone: 'warm' } }), 'Continue gently');
});

test('createLingvaLocaleContext isolates locales across concurrent async requests', async () => {
  const runtime = createLingvaNodeRuntime({
    locale: 'en',
    fallbackLocale: 'en',
    resources: {
      en: { greeting: 'Hello' },
      fr: { greeting: 'Bonjour' },
    },
  });

  const ctx = createLingvaLocaleContext(runtime);

  const [enResult, frResult] = await Promise.all([
    new Promise<string>((resolve) => {
      ctx.run('en', () => {
        // Simulate async work before reading locale
        setImmediate(() => resolve(ctx.tSync('greeting')));
      });
    }),
    new Promise<string>((resolve) => {
      ctx.run('fr', () => {
        setImmediate(() => resolve(ctx.tSync('greeting')));
      });
    }),
  ]);

  assert.equal(enResult, 'Hello');
  assert.equal(frResult, 'Bonjour');
});

test('createLingvaLocaleContext locale() returns active async context locale', () => {
  const runtime = createLingvaNodeRuntime({
    locale: 'en',
    fallbackLocale: 'en',
    resources: {
      en: { greeting: 'Hello' },
      fr: { greeting: 'Bonjour' },
    },
  });

  const ctx = createLingvaLocaleContext(runtime);

  let localeInsideRun: string | undefined;
  ctx.run('fr', () => {
    localeInsideRun = ctx.locale();
  });

  assert.equal(localeInsideRun, 'fr');
  // Outside the run, falls back to runtime default
  assert.equal(ctx.locale(), 'en');
});

test('createLingvaLocaleMiddleware binds Accept-Language locale to context', () => {
  const runtime = createLingvaNodeRuntime({
    locale: 'en',
    fallbackLocale: 'en',
    resources: {
      en: { greeting: 'Hello' },
      fr: { greeting: 'Bonjour' },
    },
  });

  const ctx = createLingvaLocaleContext(runtime);
  const middleware = createLingvaLocaleMiddleware({ context: ctx });

  const fakeReq = { headers: { 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8' } };
  let localeSeenByNext: string | undefined;

  middleware(fakeReq, {}, () => {
    localeSeenByNext = ctx.locale();
  });

  assert.equal(localeSeenByNext, 'fr-FR');
});

test('createLingvaLocaleMiddleware uses custom detectLocale when provided', () => {
  const runtime = createLingvaNodeRuntime({
    locale: 'en',
    fallbackLocale: 'en',
    resources: {
      en: { greeting: 'Hello' },
      de: { greeting: 'Hallo' },
    },
  });

  const ctx = createLingvaLocaleContext(runtime);
  const middleware = createLingvaLocaleMiddleware({
    context: ctx,
    detectLocale: (req) => req.headers['x-locale'] as string | undefined,
  });

  const fakeReq = { headers: { 'x-locale': 'de' } };
  let localeSeenByNext: string | undefined;

  middleware(fakeReq, {}, () => {
    localeSeenByNext = ctx.locale();
  });

  assert.equal(localeSeenByNext, 'de');
});

test('createLingvaNodeFileLoader returns a function', () => {
  const loader = createLingvaNodeFileLoader();
  assert.equal(typeof loader, 'function');
});
