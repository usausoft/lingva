import {
  createLingvaClientFromRuntimeConfig,
  resolveLingvaRuntimeSetup,
  type LingvaResources,
  type LingvaRuntimeConfig,
  type LingvaRuntimeLoaderFactoryOptions,
  type LingvaRuntimeSetup,
  type LocaleName,
  type TranslationKey,
  type TranslationOptions,
} from '@lingva/core';

export interface LingvaJsRuntimeSnapshot<Resources extends LingvaResources = LingvaResources> {
  error?: Error;
  loading: boolean;
  locale: LocaleName<Resources>;
}

export type LingvaJsRuntimeListener<Resources extends LingvaResources = LingvaResources> = (
  snapshot: LingvaJsRuntimeSnapshot<Resources>
) => void;

let configuredLingvaJsInput:
  | {
      input: unknown;
      options?: unknown;
    }
  | undefined;

export interface LingvaJsRuntime<Resources extends LingvaResources = LingvaResources> {
  getClient: () => ReturnType<typeof createLingvaClientFromRuntimeConfig<Resources>>;
  getAvailableLocales: () => LocaleName<Resources>[];
  getLocale: () => LocaleName<Resources>;
  getSnapshot: () => LingvaJsRuntimeSnapshot<Resources>;
  setLocale: (locale: LocaleName<Resources>) => void;
  loadLocale: (locale: LocaleName<Resources>) => Promise<void>;
  subscribe: (listener: LingvaJsRuntimeListener<Resources>) => () => void;
  destroy: () => void;
  has: (key: TranslationKey<Resources>, locale?: LocaleName<Resources>) => boolean;
  preload: (
    keys: TranslationKey<Resources>[],
    locale?: LocaleName<Resources>,
    options?: { force?: boolean; signal?: AbortSignal }
  ) => Promise<void>;
  t: <Key extends TranslationKey<Resources>>(key: Key, options?: TranslationOptions<Resources, Key>) => Promise<string>;
  tSync: <Key extends TranslationKey<Resources>>(key: Key, options?: TranslationOptions<Resources, Key>) => string;
}

/**
 * Creates a framework-agnostic Lingva runtime wrapper for plain JavaScript or
 * build-time config scenarios where React hooks are unnecessary.
 */
export function configureLingvaJs<Resources extends LingvaResources = LingvaResources>(
  input: LingvaRuntimeConfig<Resources> | LingvaRuntimeSetup<Resources>,
  options: LingvaRuntimeLoaderFactoryOptions<Resources> = {}
) {
  configuredLingvaJsInput = {
    input,
    options,
  };
}

export function clearLingvaJsConfiguration() {
  configuredLingvaJsInput = undefined;
}

export function createLingvaJsRuntime<Resources extends LingvaResources = LingvaResources>(
  input?: LingvaRuntimeConfig<Resources> | LingvaRuntimeSetup<Resources>,
  options: LingvaRuntimeLoaderFactoryOptions<Resources> = {}
): LingvaJsRuntime<Resources> {
  const runtimeInput = (input ?? configuredLingvaJsInput?.input) as
    | LingvaRuntimeConfig<Resources>
    | LingvaRuntimeSetup<Resources>
    | undefined;
  const runtimeOptions = input
    ? options
    : ((configuredLingvaJsInput?.options as LingvaRuntimeLoaderFactoryOptions<Resources> | undefined) ?? options);

  if (!runtimeInput) {
    throw new Error(
      'createLingvaJsRuntime requires config/runtime input or a registered default via configureLingvaJs().'
    );
  }

  const resolved =
    'mode' in runtimeInput
      ? resolveLingvaRuntimeSetup(runtimeInput)
      : { config: runtimeInput, loaderFactoryOptions: runtimeOptions };
  const config = resolved.config;
  const loaderFactoryOptions =
    'mode' in runtimeInput ? { ...resolved.loaderFactoryOptions, ...runtimeOptions } : runtimeOptions;
  let currentLocale = (config.locale ?? config.project?.defaultLocale ?? 'en') as LocaleName<Resources>;
  let activeLoad: AbortController | undefined;
  let snapshot: LingvaJsRuntimeSnapshot<Resources> = {
    loading: false,
    locale: currentLocale,
  };
  const listeners = new Set<LingvaJsRuntimeListener<Resources>>();
  let client = createLingvaClientFromRuntimeConfig(
    {
      ...config,
      locale: currentLocale,
    },
    loaderFactoryOptions
  );

  const rebuildClient = () => {
    client = createLingvaClientFromRuntimeConfig(
      {
        ...config,
        locale: currentLocale,
      },
      loaderFactoryOptions
    );
  };

  const publishSnapshot = (nextSnapshot: LingvaJsRuntimeSnapshot<Resources>) => {
    snapshot = nextSnapshot;
    listeners.forEach((listener) => listener(snapshot));
  };

  const selectLocale = (locale: LocaleName<Resources>) => {
    currentLocale = locale;
    rebuildClient();
  };

  return {
    getClient() {
      return client;
    },
    getAvailableLocales() {
      return client.getAvailableLocales();
    },
    getLocale() {
      return currentLocale;
    },
    getSnapshot() {
      return snapshot;
    },
    setLocale(locale) {
      activeLoad?.abort();
      activeLoad = undefined;
      selectLocale(locale);
      publishSnapshot({ loading: false, locale });
    },
    async loadLocale(locale) {
      activeLoad?.abort();
      const controller = new AbortController();
      activeLoad = controller;
      selectLocale(locale);
      publishSnapshot({ loading: true, locale });

      try {
        await client.preload([], locale, { signal: controller.signal });
        if (activeLoad === controller) {
          publishSnapshot({ loading: false, locale });
        }
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          return;
        }

        const runtimeError = error instanceof Error ? error : new Error('Lingva remote delivery failed.');
        if (activeLoad === controller) {
          publishSnapshot({ error: runtimeError, loading: false, locale });
        }
        throw runtimeError;
      } finally {
        if (activeLoad === controller) {
          activeLoad = undefined;
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot);
      return () => listeners.delete(listener);
    },
    destroy() {
      activeLoad?.abort();
      activeLoad = undefined;
      listeners.clear();
    },
    has(key, locale = currentLocale) {
      return client.has(locale, key);
    },
    async preload(keys, locale = currentLocale, preloadOptions = {}) {
      if (locale !== currentLocale) {
        selectLocale(locale);
        publishSnapshot({ loading: false, locale });
      }

      await client.preload(keys, locale, preloadOptions);
    },
    async t(key, options) {
      return client.t(key, options);
    },
    tSync(key, options) {
      return client.tSync(key, options);
    },
  };
}

export type * from '@lingva/core';
