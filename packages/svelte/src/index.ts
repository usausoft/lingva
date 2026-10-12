import { get, readable, type Readable } from 'svelte/store';
import {
  createLingvaJsRuntime,
  type LingvaJsRuntime,
  type LingvaResources,
  type LingvaRuntimeConfig,
  type LingvaRuntimeLoaderFactoryOptions,
  type LingvaRuntimeSetup,
  type LocaleName,
  type TranslationKey,
  type TranslationOptions,
} from '@lingva/js';

export interface LingvaSvelte<Resources extends LingvaResources = LingvaResources> {
  readonly error: Readable<Error | undefined>;
  readonly loading: Readable<boolean>;
  readonly locale: Readable<LocaleName<Resources>>;
  readonly ready: Promise<void>;
  readonly runtime: LingvaJsRuntime<Resources>;
  setLocale: (locale: LocaleName<Resources>) => Promise<void>;
  t: Readable<LingvaSvelteTranslator<Resources>>;
}

export type LingvaSvelteTranslator<Resources extends LingvaResources = LingvaResources> = <
  Key extends TranslationKey<Resources>,
>(
  key: Key,
  options?: TranslationOptions<Resources, Key>
) => string;

/** Creates Svelte stores backed by one cancellable Lingva runtime. */
export function createLingvaSvelte<Resources extends LingvaResources = LingvaResources>(
  input: LingvaRuntimeConfig<Resources> | LingvaRuntimeSetup<Resources>,
  options: LingvaRuntimeLoaderFactoryOptions<Resources> = {}
): LingvaSvelte<Resources> {
  const runtime = createLingvaJsRuntime(input, options);
  const locale = readable(runtime.getLocale(), (set) => runtime.subscribe((snapshot) => set(snapshot.locale)));
  const loading = readable(false, (set) => runtime.subscribe((snapshot) => set(snapshot.loading)));
  const error = readable<Error | undefined>(undefined, (set) => runtime.subscribe((snapshot) => set(snapshot.error)));
  const createTranslator = (): LingvaSvelteTranslator<Resources> => (key, translationOptions) =>
    runtime.tSync(key, translationOptions);
  const t = readable(createTranslator(), (set) => runtime.subscribe(() => set(createTranslator())));
  const ready = runtime.loadLocale(runtime.getLocale()).catch(() => undefined);

  return {
    error,
    loading,
    locale,
    ready,
    runtime,
    setLocale: (nextLocale) => runtime.loadLocale(nextLocale),
    t,
  };
}

/**
 * Creates and hydrates request-scoped stores for SvelteKit server rendering.
 * Call `runtime.destroy()` when the owning request has finished.
 */
export async function createLingvaSvelteServer<Resources extends LingvaResources = LingvaResources>(
  input: LingvaRuntimeConfig<Resources> | LingvaRuntimeSetup<Resources>,
  options: LingvaRuntimeLoaderFactoryOptions<Resources> = {}
): Promise<LingvaSvelte<Resources>> {
  const adapter = createLingvaSvelte(input, options);
  await adapter.ready;
  const error = get(adapter.error);

  if (error) {
    adapter.runtime.destroy();
    throw error;
  }

  return adapter;
}

export type * from '@lingva/js';
