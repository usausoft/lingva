import { inject, readonly, ref, type InjectionKey, type Ref } from 'vue';
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

export interface LingvaVue<Resources extends LingvaResources = LingvaResources> {
  readonly error: Readonly<Ref<Error | undefined>>;
  readonly loading: Readonly<Ref<boolean>>;
  readonly locale: Readonly<Ref<LocaleName<Resources>>>;
  readonly ready: Promise<void>;
  readonly runtime: LingvaJsRuntime<Resources>;
  install: (app: LingvaVueApp) => void;
  setLocale: (locale: LocaleName<Resources>) => Promise<void>;
  t: <Key extends TranslationKey<Resources>>(key: Key, options?: TranslationOptions<Resources, Key>) => string;
}

interface LingvaVueApp {
  provide: <T>(key: InjectionKey<T> | string, value: T) => unknown;
}

const LINGVA_VUE = Symbol('LINGVA_VUE') as InjectionKey<LingvaVue>;

/** Creates a Vue plugin with reactive Lingva state and typed translations. */
export function createLingvaVue<Resources extends LingvaResources = LingvaResources>(
  input: LingvaRuntimeConfig<Resources> | LingvaRuntimeSetup<Resources>,
  options: LingvaRuntimeLoaderFactoryOptions<Resources> = {}
): LingvaVue<Resources> {
  const runtime = createLingvaJsRuntime(input, options);
  const initialSnapshot = runtime.getSnapshot();
  const locale = ref(initialSnapshot.locale) as Ref<LocaleName<Resources>>;
  const loading = ref(initialSnapshot.loading);
  const error = ref<Error>();
  runtime.subscribe((snapshot) => {
    locale.value = snapshot.locale;
    loading.value = snapshot.loading;
    error.value = snapshot.error;
  });
  const ready = runtime.loadLocale(runtime.getLocale()).catch(() => undefined);

  const adapter: LingvaVue<Resources> = {
    error: readonly(error),
    loading: readonly(loading),
    locale,
    ready,
    runtime,
    install(app) {
      app.provide(LINGVA_VUE, adapter as unknown as LingvaVue);
    },
    setLocale: (nextLocale) => runtime.loadLocale(nextLocale),
    t: (key, translationOptions) => {
      void locale.value;
      return runtime.tSync(key, translationOptions);
    },
  };
  return adapter;
}

/**
 * Creates and hydrates a request-scoped Vue adapter for SSR runtimes such as
 * Nuxt. Call `runtime.destroy()` when the owning request has finished.
 */
export async function createLingvaVueServer<Resources extends LingvaResources = LingvaResources>(
  input: LingvaRuntimeConfig<Resources> | LingvaRuntimeSetup<Resources>,
  options: LingvaRuntimeLoaderFactoryOptions<Resources> = {}
): Promise<LingvaVue<Resources>> {
  const adapter = createLingvaVue(input, options);
  await adapter.ready;

  if (adapter.error.value) {
    const error = adapter.error.value;
    adapter.runtime.destroy();
    throw error;
  }

  return adapter;
}

/** Reads the Lingva plugin installed on the current Vue application. */
export function useLingva<Resources extends LingvaResources = LingvaResources>(): LingvaVue<Resources> {
  const adapter = inject(LINGVA_VUE);
  if (!adapter) {
    throw new Error('Lingva Vue plugin is missing. Install the value returned by createLingvaVue().');
  }
  return adapter as unknown as LingvaVue<Resources>;
}

export type * from '@lingva/js';
