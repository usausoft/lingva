import {
  InjectionToken,
  inject,
  makeEnvironmentProviders,
  signal,
  type EnvironmentProviders,
  type Signal,
} from '@angular/core';
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

export interface LingvaAngular<Resources extends LingvaResources = LingvaResources> {
  readonly error: Signal<Error | undefined>;
  readonly loading: Signal<boolean>;
  readonly locale: Signal<LocaleName<Resources>>;
  readonly ready: Promise<void>;
  readonly runtime: LingvaJsRuntime<Resources>;
  setLocale: (locale: LocaleName<Resources>) => Promise<void>;
  t: <Key extends TranslationKey<Resources>>(key: Key, options?: TranslationOptions<Resources, Key>) => string;
}

const LINGVA_ANGULAR = new InjectionToken<LingvaAngular>('LINGVA_ANGULAR');

/** Creates the signal-backed adapter used by Angular dependency injection. */
export function createLingvaAngular<Resources extends LingvaResources = LingvaResources>(
  input: LingvaRuntimeConfig<Resources> | LingvaRuntimeSetup<Resources>,
  options: LingvaRuntimeLoaderFactoryOptions<Resources> = {}
): LingvaAngular<Resources> {
  const runtime = createLingvaJsRuntime(input, options);
  const initialSnapshot = runtime.getSnapshot();
  const locale = signal(initialSnapshot.locale);
  const loading = signal(initialSnapshot.loading);
  const error = signal(initialSnapshot.error);

  runtime.subscribe((snapshot) => {
    locale.set(snapshot.locale);
    loading.set(snapshot.loading);
    error.set(snapshot.error);
  });
  const ready = runtime.loadLocale(runtime.getLocale()).catch(() => undefined);

  return {
    error: error.asReadonly(),
    loading: loading.asReadonly(),
    locale: locale.asReadonly(),
    ready,
    runtime,
    setLocale: (nextLocale) => runtime.loadLocale(nextLocale),
    t: (key, translationOptions) => {
      locale();
      return runtime.tSync(key, translationOptions);
    },
  };
}

/**
 * Creates and hydrates a request-scoped Angular adapter for server rendering.
 * Call `runtime.destroy()` when the owning request has finished.
 */
export async function createLingvaAngularServer<Resources extends LingvaResources = LingvaResources>(
  input: LingvaRuntimeConfig<Resources> | LingvaRuntimeSetup<Resources>,
  options: LingvaRuntimeLoaderFactoryOptions<Resources> = {}
): Promise<LingvaAngular<Resources>> {
  const adapter = createLingvaAngular(input, options);
  await adapter.ready;
  const error = adapter.error();

  if (error) {
    adapter.runtime.destroy();
    throw error;
  }

  return adapter;
}

/** Registers one Lingva runtime for an Angular application or route tree. */
export function provideLingvaAngular<Resources extends LingvaResources = LingvaResources>(
  input: LingvaRuntimeConfig<Resources> | LingvaRuntimeSetup<Resources>,
  options: LingvaRuntimeLoaderFactoryOptions<Resources> = {}
): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: LINGVA_ANGULAR,
      useFactory: () => createLingvaAngular(input, options),
    },
  ]);
}

/** Returns the typed Lingva adapter from the current Angular injection context. */
export function injectLingva<Resources extends LingvaResources = LingvaResources>(): LingvaAngular<Resources> {
  return inject(LINGVA_ANGULAR) as unknown as LingvaAngular<Resources>;
}

export type * from '@lingva/js';
