import { createElement, type ReactNode } from 'react';
import type {
  LingvaProject,
  LingvaRuntimeConfig,
  LingvaRuntimeLoaderFactoryOptions,
  LingvaResources,
} from '@lingva/core';
import { configureLingvaReact, LingvaProvider } from '@lingva/react';
import type { LingvaProviderProps } from '@lingva/react';

export {
  clearLingvaReactConfiguration,
  configureLingvaReact,
  LingvaText,
  LingvaProvider,
  useLingva,
  useLocale,
  useTranslation,
} from '@lingva/react';
export type { LingvaContextValue, LingvaProviderProps } from '@lingva/react';
export type * from '@lingva/core';

export type LingvaNextProviderProps<Resources extends LingvaResources = LingvaResources> = {
  children: ReactNode;
} & Omit<LingvaProviderProps<Resources>, 'children' | 'config' | 'runtime' | 'runtimeOptions'>;

export interface LingvaNextClientConfigOptions<Resources extends LingvaResources = LingvaResources> {
  config: LingvaRuntimeConfig<Resources>;
  project?: LingvaProject<Resources> | LingvaProject;
  register?: boolean;
  runtimeOptions?: LingvaRuntimeLoaderFactoryOptions<Resources>;
}

export interface LingvaNextProviderOptions<
  Resources extends LingvaResources = LingvaResources,
> extends LingvaNextClientConfigOptions<Resources> {
  displayName?: string;
}

/**
 * Thin Next.js-facing alias around the shared Lingva config contract.
 */
export function defineLingvaNextConfig<Resources extends LingvaResources = LingvaResources>(
  config: LingvaRuntimeConfig<Resources>
) {
  return config;
}

/**
 * Prepares the client-side Lingva config used by a Next.js App Router provider.
 *
 * By default this also registers the config with `@lingva/react`, allowing
 * `LingvaProvider` to be mounted without repeatedly passing the same config
 * through every app boundary.
 */
export function configureLingvaNextClient<Resources extends LingvaResources = LingvaResources>({
  config,
  project,
  register = true,
  runtimeOptions,
}: LingvaNextClientConfigOptions<Resources>): LingvaRuntimeConfig<Resources> {
  const nextConfig = {
    ...config,
    ...(project ? { project } : {}),
  } as LingvaRuntimeConfig<Resources>;

  if (register) {
    configureLingvaReact(nextConfig, runtimeOptions);
  }

  return nextConfig;
}

/**
 * Creates a small client provider component for Next.js App Router projects.
 *
 * This helper keeps generated provider modules compact while still allowing
 * callers to override locale, locale-change handling, or editor settings at
 * the app boundary.
 */
export function createLingvaNextProvider<Resources extends LingvaResources = LingvaResources>(
  options: LingvaNextProviderOptions<Resources>
) {
  const config = configureLingvaNextClient(options);

  function LingvaNextProvider({ children, ...props }: LingvaNextProviderProps<Resources>) {
    return createElement(
      LingvaProvider<Resources>,
      {
        ...props,
        config,
        runtimeOptions: options.runtimeOptions,
      },
      children
    );
  }

  LingvaNextProvider.displayName = options.displayName ?? 'LingvaNextProvider';

  return LingvaNextProvider;
}
