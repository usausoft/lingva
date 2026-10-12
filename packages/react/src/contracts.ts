import type { ComponentType, ElementType, PropsWithChildren } from 'react';
import type {
  LingvaClient,
  LingvaMessage,
  LingvaRuntimeConfig,
  LingvaRuntimeLoaderFactoryOptions,
  LingvaResources,
  LingvaRuntimeSetup,
  LocaleName,
  TranslationKey,
  TranslationOptions,
  TranslationVariables,
} from '@lingva/core';

/**
 * Shared value exposed through `LingvaProvider`.
 */
export interface LingvaContextValue<Resources extends LingvaResources = LingvaResources> {
  client: LingvaClient<Resources>;
  deliveryError?: Error;
  deliveryLoading: boolean;
  locale: LocaleName<Resources>;
  setLocale: (locale: LocaleName<Resources>) => void;
  editor?: LingvaEditorConfig<Resources>;
  t: <Key extends TranslationKey<Resources>>(key: Key, options?: TranslationOptions<Resources, Key>) => Promise<string>;
  tSync: <Key extends TranslationKey<Resources>>(key: Key, options?: TranslationOptions<Resources, Key>) => string;
}

export interface LingvaEditorSavePayload<
  Resources extends LingvaResources = LingvaResources,
  Key extends TranslationKey<Resources> = TranslationKey<Resources>,
> {
  key: Key;
  locale: LocaleName<Resources>;
  value: string;
  variantId?: string;
}

export interface LingvaEditorConfig<Resources extends LingvaResources = LingvaResources> {
  enabled?: boolean;
  canSave?: boolean;
  onSave?: <Key extends TranslationKey<Resources>>(
    payload: LingvaEditorSavePayload<Resources, Key>
  ) => Promise<void> | void;
  getStudioUrl?: <Key extends TranslationKey<Resources>>(
    payload: Pick<LingvaEditorSavePayload<Resources, Key>, 'key' | 'locale' | 'variantId'>
  ) => string | undefined;
}

export interface LingvaProviderConfigProps<
  Resources extends LingvaResources = LingvaResources,
> extends PropsWithChildren {
  config: LingvaRuntimeConfig<Resources>;
  runtimeOptions?: LingvaRuntimeLoaderFactoryOptions<Resources>;
  locale?: LocaleName<Resources>;
  onLocaleChange?: (locale: LocaleName<Resources>) => void;
  editor?: LingvaEditorConfig<Resources>;
}

export interface LingvaProviderRuntimeProps<
  Resources extends LingvaResources = LingvaResources,
> extends PropsWithChildren {
  runtime: LingvaRuntimeSetup<Resources>;
  locale?: LocaleName<Resources>;
  onLocaleChange?: (locale: LocaleName<Resources>) => void;
  editor?: LingvaEditorConfig<Resources>;
}

export interface LingvaProviderAutoProps<
  Resources extends LingvaResources = LingvaResources,
> extends PropsWithChildren {
  locale?: LocaleName<Resources>;
  onLocaleChange?: (locale: LocaleName<Resources>) => void;
  editor?: LingvaEditorConfig<Resources>;
}

/**
 * Props for the React provider wrapper around `LingvaClient`.
 */
export type LingvaProviderProps<Resources extends LingvaResources = LingvaResources> =
  | LingvaProviderConfigProps<Resources>
  | LingvaProviderRuntimeProps<Resources>
  | LingvaProviderAutoProps<Resources>;

export interface LingvaTextProps<
  Resources extends LingvaResources = LingvaResources,
  Key extends TranslationKey<Resources> = TranslationKey<Resources>,
> {
  keyName: Key;
  as?: ElementType;
  className?: string;
  locale?: LocaleName<Resources>;
  fallback?: LocaleName<Resources> | false;
  defaultValue?: string;
  variables?: TranslationVariables<Resources, Key>;
  variant?: TranslationOptions<Resources, Key>['variant'];
  editable?: boolean;
  children?: never;
}

export interface LingvaTextEditorState<
  Resources extends LingvaResources = LingvaResources,
  Key extends TranslationKey<Resources> = TranslationKey<Resources>,
> {
  key: Key;
  locale: LocaleName<Resources>;
  rawMessage?: LingvaMessage;
  variant?: TranslationOptions<Resources, Key>['variant'];
}

export interface LingvaInlineTextEditorProps<
  Resources extends LingvaResources = LingvaResources,
  Key extends TranslationKey<Resources> = TranslationKey<Resources>,
> {
  state: LingvaTextEditorState<Resources, Key>;
  localeOptions: LocaleName<Resources>[];
  selectedLocale: LocaleName<Resources>;
  onLocaleChange: (locale: LocaleName<Resources>) => void;
  variantOptions: Array<{ id: string; label: string }>;
  selectedVariantId?: string;
  onVariantChange: (variantId?: string) => void;
  localeStatuses: Array<{
    locale: LocaleName<Resources>;
    status: (typeof LINGVA_LOCALE_AVAILABILITY_STATUSES)[keyof typeof LINGVA_LOCALE_AVAILABILITY_STATUSES];
  }>;
  value: string;
  saving: boolean;
  error: string | null;
  canOpenStudio: boolean;
  canSave: boolean;
  onCopyKey: () => void;
  onOpenStudio: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export type LingvaInlineTextEditorComponent<Resources extends LingvaResources = LingvaResources> = ComponentType<
  LingvaInlineTextEditorProps<Resources>
>;
export const LINGVA_LOCALE_AVAILABILITY_STATUSES = {
  missing: 'missing',
  present: 'present',
} as const;
