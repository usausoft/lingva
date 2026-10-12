import { LingvaClient } from './runtime';
import {
  LINGVA_DELIVERY_CACHE_STRATEGIES,
  LINGVA_DELIVERY_MODES,
  LINGVA_DELIVERY_QUERY_PARAMS,
  LINGVA_HTTP_HEADERS,
  LINGVA_RUNTIME_MODES,
} from './constants';
import type {
  LingvaConfig,
  LingvaDeliveryConfig,
  LingvaDeliveryCacheConfig,
  LingvaDictionary,
  LingvaFlatDictionary,
  LingvaHttpLoaderOptions,
  LingvaLocalLoaderOptions,
  LingvaMessage,
  LingvaMessageVariant,
  LingvaMessageVariants,
  LingvaResourceLoader,
  LingvaResourceLoaderContext,
  LingvaResourceLoaderRequest,
  LingvaResources,
  LingvaRuntimeConfig,
  LingvaRuntimeLoaderFactoryOptions,
  LingvaRuntimeSetup,
  LocaleName,
  ResolvedLingvaRuntimeSetup,
  TranslationKey,
} from './contracts';

export const DEFAULT_REMOTE_BUNDLE_PATH_TEMPLATE = '/bundles/{projectId}/{environment}/latest/{locale}.bundle.json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLingvaMessageVariant(value: unknown): value is LingvaMessageVariant {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.id === 'string' && value.id.trim().length > 0 && typeof value.text === 'string';
}

function isLingvaMessageVariants(value: unknown): value is LingvaMessageVariants {
  return Array.isArray(value) && value.every(isLingvaMessageVariant);
}

function flattenLingvaDictionary(dictionary: LingvaDictionary, prefix = ''): LingvaFlatDictionary {
  const output: LingvaFlatDictionary = {};

  for (const [key, value] of Object.entries(dictionary)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      output[path] = value;
      continue;
    }

    if (isLingvaMessageVariants(value)) {
      output[path] = value;
      continue;
    }

    if (isRecord(value)) {
      Object.assign(output, flattenLingvaDictionary(value, path));
    }
  }

  return output;
}

/**
 * Delivery helpers convert a higher-level runtime config into concrete resource
 * loaders so the same project can run from local files or hosted bundles.
 */
function normalizeDeliveryPayload(payload: unknown): Partial<LingvaFlatDictionary> {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Lingva delivery payload must be an object.');
  }

  if ('resources' in payload && payload.resources && typeof payload.resources === 'object') {
    return flattenLingvaDictionary(payload.resources as LingvaDictionary);
  }

  if ('translations' in payload && payload.translations && typeof payload.translations === 'object') {
    return flattenLingvaDictionary(payload.translations as LingvaDictionary);
  }

  if ('messages' in payload && payload.messages && typeof payload.messages === 'object') {
    const messages = flattenLingvaDictionary(payload.messages as LingvaDictionary);

    if ('variants' in payload && payload.variants && typeof payload.variants === 'object') {
      return {
        ...messages,
        ...flattenLingvaDictionary(payload.variants as LingvaDictionary),
      };
    }

    return messages;
  }

  return flattenLingvaDictionary(payload as LingvaDictionary);
}

function applyTemplate(template: string, request: { locale: string }, context: LingvaResourceLoaderContext): string {
  const replacements: Record<string, string> = {
    locale: String(request.locale),
    projectId: context.projectId ?? '',
    apiUrl: context.apiUrl ?? '',
    environment: context.environment ?? '',
  };

  return template.replaceAll(/\{(\w+)\}/g, (match, token) => replacements[token] ?? match);
}

function normalizeLocalPath(
  pathTemplate: string,
  request: { locale: string },
  context: LingvaResourceLoaderContext
): string {
  return applyTemplate(pathTemplate, request, context);
}

function normalizeHttpUrl<Resources extends LingvaResources>(
  options: LingvaHttpLoaderOptions<Resources>,
  request: { locale: string; keys?: string[] },
  context: LingvaResourceLoaderContext
): string {
  const url = new URL(applyTemplate(options.url, request, context));
  const localeParam = options.localeQueryParam ?? LINGVA_DELIVERY_QUERY_PARAMS.locale;
  const projectIdParam = options.projectIdQueryParam ?? LINGVA_DELIVERY_QUERY_PARAMS.projectId;
  const keysParam = options.keysQueryParam ?? LINGVA_DELIVERY_QUERY_PARAMS.keys;
  const environmentParam = 'environment';

  url.searchParams.set(localeParam, String(request.locale));

  if (context.projectId) {
    url.searchParams.set(projectIdParam, context.projectId);
  }

  if (context.environment) {
    url.searchParams.set(environmentParam, context.environment);
  }

  if (request.keys && request.keys.length > 0) {
    url.searchParams.set(keysParam, request.keys.join(','));
  }

  return url.toString();
}

function createDefaultRemoteBundleUrl(apiUrl: string | undefined): string {
  if (!apiUrl) {
    throw new Error('Lingva remote runtime setup requires either remote.url or apiUrl.');
  }

  return `${apiUrl.replace(/\/+$/, '')}${DEFAULT_REMOTE_BUNDLE_PATH_TEMPLATE}`;
}

type CachedLoaderEntry<Resources extends LingvaResources> = {
  expiresAt: number;
  inflight?: Promise<Partial<Record<TranslationKey<Resources>, LingvaMessage>>>;
  value?: Partial<Record<TranslationKey<Resources>, LingvaMessage>>;
};

function shouldUseMemoryCache(cache: LingvaDeliveryCacheConfig | undefined): cache is LingvaDeliveryCacheConfig {
  return cache !== undefined && cache.memory !== false;
}

function createDeliveryCacheKey<Resources extends LingvaResources>(
  request: LingvaResourceLoaderRequest<Resources>,
  context: LingvaResourceLoaderContext
): string {
  return JSON.stringify({
    environment: context.environment ?? '',
    keys: request.keys && request.keys.length > 0 ? [...request.keys].map(String).sort() : null,
    locale: String(request.locale),
    projectId: context.projectId ?? '',
  });
}

function getDeliveryCacheExpiresAt(cache: LingvaDeliveryCacheConfig, now: number): number {
  if (cache.ttl === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  if (!Number.isFinite(cache.ttl) || cache.ttl <= 0) {
    return now;
  }

  return now + cache.ttl * 1000;
}

function withMemoryCache<Resources extends LingvaResources>(
  loader: LingvaResourceLoader<Resources>,
  cache: LingvaDeliveryCacheConfig | undefined
): LingvaResourceLoader<Resources> {
  if (!shouldUseMemoryCache(cache)) {
    return loader;
  }

  const cacheConfig = cache;
  const entries = new Map<string, CachedLoaderEntry<Resources>>();

  async function refresh(
    cacheKey: string,
    request: LingvaResourceLoaderRequest<Resources>,
    context: LingvaResourceLoaderContext
  ) {
    const inflight = loader
      .load(request, context)
      .then((value) => {
        entries.set(cacheKey, {
          expiresAt: getDeliveryCacheExpiresAt(cacheConfig, Date.now()),
          value,
        });

        return value;
      })
      .catch((cause) => {
        const current = entries.get(cacheKey);

        if (current?.value) {
          entries.set(cacheKey, {
            expiresAt: Date.now(),
            value: current.value,
          });
        } else {
          entries.delete(cacheKey);
        }

        throw cause;
      });

    entries.set(cacheKey, {
      ...(entries.get(cacheKey) ?? { expiresAt: 0 }),
      inflight,
    });

    return inflight;
  }

  return {
    async load<Locale extends LocaleName<Resources> = LocaleName<Resources>>(
      request: LingvaResourceLoaderRequest<Resources, Locale>,
      context: LingvaResourceLoaderContext
    ) {
      request.signal?.throwIfAborted();

      // A caller-owned abort signal must never control a promise shared with
      // unrelated consumers. Cancel-aware loads therefore bypass deduplication.
      if (request.signal) {
        return loader.load(request, context);
      }

      const cacheKey = createDeliveryCacheKey(request, context);
      const cached = entries.get(cacheKey);
      const now = Date.now();

      if (!request.force && cached?.value && cached.expiresAt > now) {
        return cached.value;
      }

      if (!request.force && cached?.inflight) {
        return cached.inflight;
      }

      if (
        !request.force &&
        cached?.value &&
        cacheConfig.strategy === LINGVA_DELIVERY_CACHE_STRATEGIES.backgroundRevalidate
      ) {
        void refresh(cacheKey, request, context).catch(() => undefined);

        return cached.value;
      }

      return refresh(cacheKey, request, context);
    },
  };
}

const DEFAULT_HTTP_TIMEOUT_MS = 10_000;

function createHttpRequestSignal(input: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const abortFromInput = () => controller.abort(input?.reason);
  const timeout = setTimeout(() => controller.abort(new Error('Lingva HTTP loader request timed out.')), timeoutMs);

  if (input?.aborted) {
    abortFromInput();
  } else {
    input?.addEventListener('abort', abortFromInput, { once: true });
  }

  return {
    dispose() {
      clearTimeout(timeout);
      input?.removeEventListener('abort', abortFromInput);
    },
    signal: controller.signal,
  };
}

function getRuntimeSetupConfigFields<Resources extends LingvaResources>(setup: LingvaRuntimeSetup<Resources>) {
  const configFields = { ...setup } as Record<string, unknown>;

  delete configFields.fetcher;
  delete configFields.readFile;
  delete configFields.parseResponse;
  delete configFields.parseFile;
  delete configFields.decode;
  delete configFields.mode;
  delete configFields.remote;
  delete configFields.local;

  return configFields as Omit<
    LingvaRuntimeSetup<Resources>,
    'decode' | 'fetcher' | 'local' | 'mode' | 'parseFile' | 'parseResponse' | 'readFile' | 'remote'
  >;
}

/**
 * Preserves literal types when defining a `lingva.ts`-style runtime config.
 */
export function defineLingvaConfig<const Config extends LingvaRuntimeConfig & Record<string, unknown>>(
  config: Config
): Config {
  return config;
}

/**
 * Expands a high-level runtime setup into the lower-level config + loader
 * factory options used by Lingva clients and framework adapters.
 */
export function resolveLingvaRuntimeSetup<Resources extends LingvaResources = LingvaResources>(
  setup: LingvaRuntimeSetup<Resources>
): ResolvedLingvaRuntimeSetup<Resources> {
  const loaderFactoryOptions: LingvaRuntimeLoaderFactoryOptions<Resources> = {
    fetcher: setup.fetcher,
    readFile: setup.readFile,
    parseResponse: setup.parseResponse,
    parseFile: setup.parseFile,
    decode: setup.decode,
  };

  if (setup.mode === LINGVA_RUNTIME_MODES.remote) {
    const configFields = getRuntimeSetupConfigFields(setup);
    const { remote } = setup;

    return {
      config: {
        ...configFields,
        delivery: {
          mode: LINGVA_DELIVERY_MODES.cdn,
          url: remote?.url ?? createDefaultRemoteBundleUrl(configFields.apiUrl),
          headers: remote?.headers,
          apiKeyHeader: remote?.apiKeyHeader,
          projectIdHeader: remote?.projectIdHeader,
          localeQueryParam: remote?.localeQueryParam,
          keysQueryParam: remote?.keysQueryParam,
          projectIdQueryParam: remote?.projectIdQueryParam,
          cache: remote?.cache,
        },
      },
      loaderFactoryOptions,
    };
  }

  const configFields = getRuntimeSetupConfigFields(setup);
  const { local } = setup;

  if (!configFields.project && !configFields.resources && !local?.path) {
    throw new Error('Lingva local runtime setup requires project, resources, or local.path.');
  }

  return {
    config: {
      ...configFields,
      delivery: local?.path
        ? {
            mode: LINGVA_DELIVERY_MODES.local,
            path: local.path,
            cache: local.cache,
          }
        : undefined,
    },
    loaderFactoryOptions,
  };
}

/**
 * Creates an HTTP-based loader for hosted bundle delivery.
 */
export function createLingvaHttpLoader<Resources extends LingvaResources = LingvaResources>(
  options: LingvaHttpLoaderOptions<Resources>
): LingvaResourceLoader<Resources> {
  const fetcher = options.fetcher ?? globalThis.fetch;

  if (!fetcher) {
    throw new Error('Lingva HTTP loader requires a fetch implementation.');
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('Lingva HTTP loader timeoutMs must be a positive finite number.');
  }

  return withMemoryCache(
    {
      async load<Locale extends LocaleName<Resources> = LocaleName<Resources>>(
        request: LingvaResourceLoaderRequest<Resources, Locale>,
        context: LingvaResourceLoaderContext
      ) {
        const headers = new Headers(options.headers);
        const apiKey = options.apiKey ?? context.apiKey;

        if (apiKey) {
          headers.set(options.apiKeyHeader ?? LINGVA_HTTP_HEADERS.apiKey, apiKey);
        }

        if (context.projectId) {
          headers.set(options.projectIdHeader ?? LINGVA_HTTP_HEADERS.projectId, context.projectId);
        }

        const requestSignal = createHttpRequestSignal(request.signal, timeoutMs);
        let response: Response;

        try {
          response = await fetcher(normalizeHttpUrl(options, request, context), {
            headers,
            signal: requestSignal.signal,
          });
        } finally {
          requestSignal.dispose();
        }

        if (!response.ok) {
          throw new Error(`Lingva HTTP loader failed with ${response.status} ${response.statusText}.`);
        }

        const payload = options.parseResponse
          ? await options.parseResponse(response, request, context)
          : ((await response.json()) as unknown);

        if (options.decode) {
          return options.decode(payload, request as LingvaResourceLoaderRequest<Resources>, context) as Promise<
            Partial<Record<TranslationKey<Resources>, LingvaMessage>>
          >;
        }

        return normalizeDeliveryPayload(payload) as Partial<Record<TranslationKey<Resources>, LingvaMessage>>;
      },
    },
    options.cache
  );
}

/**
 * Creates a local file loader for repository-backed bundle delivery.
 */
export function createLingvaLocalLoader<Resources extends LingvaResources = LingvaResources>(
  options: LingvaLocalLoaderOptions<Resources>
): LingvaResourceLoader<Resources> {
  return withMemoryCache(
    {
      async load<Locale extends LocaleName<Resources> = LocaleName<Resources>>(
        request: LingvaResourceLoaderRequest<Resources, Locale>,
        context: LingvaResourceLoaderContext
      ) {
        const filePath = normalizeLocalPath(options.path, request, context);
        const fileContents = await options.readFile(filePath);
        const serializedFile = typeof fileContents === 'string' ? fileContents : new TextDecoder().decode(fileContents);
        const payload = options.parseFile
          ? await options.parseFile(fileContents, filePath, request, context)
          : (JSON.parse(serializedFile) as unknown);

        if (options.decode) {
          return options.decode(payload, request as LingvaResourceLoaderRequest<Resources>, context) as Promise<
            Partial<Record<TranslationKey<Resources>, LingvaMessage>>
          >;
        }

        return normalizeDeliveryPayload(payload) as Partial<Record<TranslationKey<Resources>, LingvaMessage>>;
      },
    },
    options.cache
  );
}

function createLingvaLoaderFromDeliveryConfig<Resources extends LingvaResources = LingvaResources>(
  delivery: LingvaDeliveryConfig,
  config: LingvaRuntimeConfig<Resources>,
  options: LingvaRuntimeLoaderFactoryOptions<Resources> = {}
): LingvaResourceLoader<Resources> | undefined {
  if (delivery.mode === LINGVA_DELIVERY_MODES.cdn) {
    return createLingvaHttpLoader({
      url: delivery.url,
      headers: delivery.headers,
      apiKey: config.apiKey,
      apiKeyHeader: delivery.apiKeyHeader,
      projectIdHeader: delivery.projectIdHeader,
      localeQueryParam: delivery.localeQueryParam,
      keysQueryParam: delivery.keysQueryParam,
      projectIdQueryParam: delivery.projectIdQueryParam,
      timeoutMs: delivery.timeoutMs,
      cache: delivery.cache,
      fetcher: options.fetcher,
      parseResponse: options.parseResponse,
      decode: options.decode,
    });
  }

  if (!options.readFile) {
    if (config.resources || config.project?.resources) {
      return undefined;
    }

    throw new Error('Lingva local delivery mode requires a readFile implementation.');
  }

  return createLingvaLocalLoader({
    path: delivery.path,
    cache: delivery.cache,
    readFile: options.readFile,
    parseFile: options.parseFile,
    decode: options.decode,
  });
}

/**
 * Resolves a runtime config into the concrete client config consumed by `LingvaClient`.
 * This is the main bridge between project definitions, delivery settings, and runtime use.
 */
export function resolveLingvaRuntimeConfig<Resources extends LingvaResources = LingvaResources>(
  config: LingvaRuntimeConfig<Resources>,
  options: LingvaRuntimeLoaderFactoryOptions<Resources> = {}
): LingvaConfig<Resources> {
  const project = config.project;
  const loader =
    config.loader ??
    (config.delivery ? createLingvaLoaderFromDeliveryConfig(config.delivery, config, options) : undefined);

  return {
    apiKey: config.apiKey ?? project?.apiKey,
    apiUrl: config.apiUrl ?? project?.apiUrl,
    projectId: config.projectId ?? project?.projectId,
    environment: config.environment ?? project?.environment,
    locales: config.locales,
    defaultLocale: config.defaultLocale ?? project?.defaultLocale,
    locale: config.locale ?? config.defaultLocale ?? project?.defaultLocale,
    fallbackLocale: config.fallbackLocale ?? project?.fallbackLocale,
    resources: config.resources ?? project?.resources,
    loader,
  };
}

/**
 * Creates a ready-to-use `LingvaClient` from a higher-level runtime config.
 */
export function createLingvaClientFromRuntimeConfig<Resources extends LingvaResources = LingvaResources>(
  config: LingvaRuntimeConfig<Resources>,
  options: LingvaRuntimeLoaderFactoryOptions<Resources> = {}
): LingvaClient<Resources> {
  return new LingvaClient(resolveLingvaRuntimeConfig(config, options));
}
