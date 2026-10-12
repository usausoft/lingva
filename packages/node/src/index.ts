import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';
import { createLingvaJsRuntime, type LingvaJsRuntime } from '@lingva/js';
import type {
  LingvaResources,
  LingvaRuntimeConfig,
  LingvaRuntimeSetup,
  TranslationKey,
  TranslationOptions,
} from '@lingva/core';

export { createLingvaJsRuntime } from '@lingva/js';
export type * from '@lingva/js';

/**
 * Returns a fileLoader backed by node:fs/promises for use with local delivery mode.
 * Pass the result as `readFile` in loader factory options, or use
 * `createLingvaNodeRuntime` which injects it automatically.
 */
export function createLingvaNodeFileLoader(): (path: string) => Promise<Uint8Array> {
  return (path: string) => readFile(path);
}

export interface LingvaLocaleContext<Resources extends LingvaResources = LingvaResources> {
  /**
   * Runs `fn` with `locale` as the active locale for the duration of the call.
   * Uses AsyncLocalStorage so concurrent requests each see their own locale.
   */
  run<T>(locale: string, fn: () => T): T;
  /** Returns the locale active in the current async context, or the runtime default. */
  locale(): string;
  /** Synchronous translation bound to the current async context locale. */
  tSync: LingvaJsRuntime<Resources>['tSync'];
}

/**
 * Creates a per-request locale context backed by AsyncLocalStorage.
 * Each HTTP request calls `ctx.run(locale, handler)` to bind its locale;
 * `ctx.tSync` and `ctx.locale()` then read from the active async context.
 */
export function createLingvaLocaleContext<Resources extends LingvaResources = LingvaResources>(
  runtime: LingvaJsRuntime<Resources>
): LingvaLocaleContext<Resources> {
  const storage = new AsyncLocalStorage<string>();

  return {
    run<T>(locale: string, fn: () => T): T {
      return storage.run(locale, fn);
    },
    locale(): string {
      return storage.getStore() ?? runtime.getLocale();
    },
    tSync<Key extends TranslationKey<Resources>>(key: Key, options?: TranslationOptions<Resources, Key>): string {
      const locale = (storage.getStore() ?? runtime.getLocale()) as Parameters<typeof runtime.setLocale>[0];
      return runtime.tSync(key, { locale, ...options } as TranslationOptions<Resources, Key>);
    },
  };
}

export interface LingvaLocaleMiddlewareOptions<Resources extends LingvaResources = LingvaResources> {
  context: LingvaLocaleContext<Resources>;
  /**
   * Custom locale detector. Receives the raw Node.js IncomingMessage.
   * Default: first tag of Accept-Language header.
   */
  detectLocale?: (req: { headers: Record<string, string | string[] | undefined> }) => string | undefined;
}

/**
 * Returns an Express/Koa/Fastify-compatible middleware that binds the request
 * locale via `context.run()` before calling `next()`.
 *
 * Express: `app.use(createLingvaLocaleMiddleware({ context }))`
 * Koa:     `app.use((ctx, next) => middleware(ctx.req, ctx.res, next))`
 */
export function createLingvaLocaleMiddleware<Resources extends LingvaResources = LingvaResources>({
  context,
  detectLocale,
}: LingvaLocaleMiddlewareOptions<Resources>): (
  req: { headers: Record<string, string | string[] | undefined> },
  res: unknown,
  next: () => void
) => void {
  const resolveLocale = detectLocale ?? defaultDetectLocale;

  return (req, _res, next) => {
    const locale = resolveLocale(req) ?? context.locale();
    context.run(locale, next);
  };
}

function defaultDetectLocale(req: { headers: Record<string, string | string[] | undefined> }): string | undefined {
  const header = req.headers['accept-language'];
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return undefined;
  // Take the first language tag before any quality weighting (e.g. "fr-FR,fr;q=0.9,en;q=0.8" → "fr-FR")
  const first = raw.split(',')[0]?.split(';')[0]?.trim();
  return first || undefined;
}

/**
 * Creates a Node.js runtime with the built-in fs file loader.
 * Use this instead of `createLingvaJsRuntime` when your delivery config
 * uses `mode: 'local'` and you want automatic node:fs reading without
 * supplying your own readFile callback.
 */
export function createLingvaNodeRuntime<Resources extends LingvaResources = LingvaResources>(
  input: LingvaRuntimeConfig<Resources> | LingvaRuntimeSetup<Resources>
): LingvaJsRuntime<Resources> {
  return createLingvaJsRuntime(input, { readFile: createLingvaNodeFileLoader() });
}
