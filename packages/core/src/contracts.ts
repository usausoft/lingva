import type { LingvaClient } from './runtime';
import type {
  LingvaDeliveryCacheStrategy,
  LingvaSerializationFormat,
  LingvaValidationIssueCode,
  LingvaValidationSeverity,
  LingvaWorkflowStatus,
  LingvaWorkflowSummaryStatus,
} from './constants';
import type {
  LINGVA_BUNDLE_SCHEMA_VERSION,
  LINGVA_DELIVERY_MODES,
  LINGVA_RUNTIME_MODES,
  LINGVA_VALIDATION_FAIL_MODES,
} from './constants';

export type { LingvaWorkflowStatus } from './constants';

export type LingvaLocale = string;

export interface LingvaMessageVariant {
  id: string;
  text: string;
  tone?: string;
  mood?: string;
  intonation?: string;
  label?: string;
  context?: string;
}

export type LingvaMessageVariants = readonly LingvaMessageVariant[];

export type LingvaMessage = string | LingvaMessageVariants;

export type LingvaDictionary = {
  [key: string]: LingvaMessage | LingvaDictionary;
};

export type LingvaFlatDictionary = Record<string, LingvaMessage>;

export type LingvaResources = Record<LingvaLocale, LingvaDictionary>;

type ExtractString<T> = Extract<T, string>;
type PreviousDepth = [never, 0, 1, 2, 3, 4, 5];

type LocaleKeys<Resources extends LingvaResources> = ExtractString<keyof Resources>;

type NestedDictionaryKeys<
  Dictionary extends LingvaDictionary,
  Prefix extends string = '',
  Depth extends number = 5,
> = ExtractString<
  [Depth] extends [0]
    ? never
    : {
        [Key in keyof Dictionary]: Dictionary[Key] extends LingvaMessage
          ? `${Prefix}${Extract<Key, string>}`
          : Dictionary[Key] extends LingvaDictionary
            ? NestedDictionaryKeys<Dictionary[Key], `${Prefix}${Extract<Key, string>}.`, PreviousDepth[Depth]>
            : never;
      }[keyof Dictionary]
>;

type DictionaryKeys<Resources extends LingvaResources> = ExtractString<
  {
    [Locale in keyof Resources]: Resources[Locale] extends LingvaDictionary
      ? NestedDictionaryKeys<Resources[Locale]>
      : never;
  }[keyof Resources]
>;

type PrimitiveInterpolationValue = string | number | boolean | null | undefined;

type TokenToShape<Token extends string> = Token extends `${infer Head}.${infer Tail}`
  ? { [Key in Head]: TokenToShape<Tail> }
  : { [Key in Token]: PrimitiveInterpolationValue };

type UnionToIntersection<Union> = (Union extends unknown ? (value: Union) => void : never) extends (
  value: infer Intersection
) => void
  ? Intersection
  : never;

type Simplify<T> = { [Key in keyof T]: T[Key] } & {};

type MergeTokenShapes<Tokens extends string> = Simplify<UnionToIntersection<TokenToShape<Tokens>>>;

type ExtractBraceTokens<Message extends string> = Message extends `${string}{${infer Token}}${infer Rest}`
  ? Token | ExtractBraceTokens<Rest>
  : never;

type TrimWhitespace<Value extends string> = Value extends
  | ` ${infer Rest}`
  | `${infer Rest} `
  | `\n${infer Rest}`
  | `${infer Rest}\n`
  | `\t${infer Rest}`
  | `${infer Rest}\t`
  ? TrimWhitespace<Rest>
  : Value;

type ExtractMustacheTokens<Message extends string> = Message extends `${string}{{${infer Token}}}${infer Rest}`
  ? TrimWhitespace<Token> | ExtractMustacheTokens<Rest>
  : never;

type ExtractTokens<Message extends string> = ExtractBraceTokens<Message> | ExtractMustacheTokens<Message>;

type HasIcuTemplate<Message extends string> = Message extends `${string}, plural, ${string}`
  ? true
  : Message extends `${string}, select, ${string}`
    ? true
    : Message extends `${string}, selectordinal, ${string}`
      ? true
      : false;

type VariablesFromMessage<Message extends string> =
  HasIcuTemplate<Message> extends true
    ? Record<string, PrimitiveInterpolationValue>
    : [ExtractTokens<Message>] extends [never]
      ? Record<string, never>
      : MergeTokenShapes<ExtractTokens<Message>>;

type VariablesFromLingvaMessage<Message extends LingvaMessage> = Message extends string
  ? VariablesFromMessage<Message>
  : Message extends readonly (infer Variant)[]
    ? Variant extends { text: infer VariantText extends string }
      ? VariablesFromMessage<VariantText>
      : Record<string, never>
    : Record<string, never>;

type PathValue<Dictionary, Key extends string, Depth extends number = 5> = Dictionary extends LingvaDictionary
  ? [Depth] extends [0]
    ? never
    : Key extends keyof Dictionary
      ? Dictionary[Key]
      : Key extends `${infer Head}.${infer Tail}`
        ? Head extends keyof Dictionary
          ? PathValue<Extract<Dictionary[Head], LingvaDictionary>, Tail, PreviousDepth[Depth]>
          : never
        : never
  : never;

type MessageForKey<Resources extends LingvaResources, Key extends string> = Extract<
  {
    [Locale in keyof Resources]: Resources[Locale] extends LingvaDictionary ? PathValue<Resources[Locale], Key> : never;
  }[keyof Resources],
  LingvaMessage
>;

type VariantForMessage<Message extends LingvaMessage> = Message extends readonly (infer Variant)[]
  ? Extract<Variant, LingvaMessageVariant>
  : never;

type VariantForKey<Resources extends LingvaResources, Key extends string> = VariantForMessage<
  MessageForKey<Resources, Key>
>;

type VariantFieldValue<
  Resources extends LingvaResources,
  Key extends TranslationKey<Resources>,
  Field extends keyof LingvaMessageVariant,
> = ExtractString<VariantForKey<Resources, Key>[Field]>;

type VariantSelectorField<
  Resources extends LingvaResources,
  Key extends TranslationKey<Resources>,
  Field extends keyof LingvaMessageVariant,
> = [VariantFieldValue<Resources, Key, Field>] extends [never] ? string : VariantFieldValue<Resources, Key, Field>;

export type LocaleName<Resources extends LingvaResources> = [LocaleKeys<Resources>] extends [never]
  ? LingvaLocale
  : LocaleKeys<Resources>;

export type TranslationKey<Resources extends LingvaResources> = [DictionaryKeys<Resources>] extends [never]
  ? string
  : DictionaryKeys<Resources>;

export type TranslationVariables<
  Resources extends LingvaResources,
  Key extends TranslationKey<Resources>,
> = VariablesFromLingvaMessage<MessageForKey<Resources, Key>>;

export type TranslationVariantId<Resources extends LingvaResources, Key extends TranslationKey<Resources>> = [
  VariantFieldValue<Resources, Key, 'id'>,
] extends [never]
  ? string
  : VariantFieldValue<Resources, Key, 'id'>;

export interface TranslationVariantSelector<Resources extends LingvaResources, Key extends TranslationKey<Resources>> {
  id?: TranslationVariantId<Resources, Key>;
  tone?: VariantSelectorField<Resources, Key, 'tone'>;
  mood?: VariantSelectorField<Resources, Key, 'mood'>;
  intonation?: VariantSelectorField<Resources, Key, 'intonation'>;
  label?: VariantSelectorField<Resources, Key, 'label'>;
}

export type TranslationVariant<Resources extends LingvaResources, Key extends TranslationKey<Resources>> =
  | TranslationVariantId<Resources, Key>
  | TranslationVariantSelector<Resources, Key>;

export interface LingvaKeyMetadata {
  description?: string;
  context?: string;
  namespace?: string;
  tags?: string[];
  deprecated?: boolean;
  status?: LingvaWorkflowStatus;
  translator?: string;
  reviewer?: string;
}

export type LingvaProjectKeyMetadata<Resources extends LingvaResources> = Partial<
  Record<TranslationKey<Resources>, LingvaKeyMetadata>
>;

export interface LingvaResourceLoaderContext {
  apiKey?: string;
  apiUrl?: string;
  projectId?: string;
  environment?: string;
}

export interface LingvaResourceLoaderRequest<
  Resources extends LingvaResources = LingvaResources,
  Locale extends LocaleName<Resources> = LocaleName<Resources>,
> {
  force?: boolean;
  locale: Locale;
  keys?: TranslationKey<Resources>[];
  signal?: AbortSignal;
}

export interface LingvaResourceLoader<Resources extends LingvaResources = LingvaResources> {
  load: <Locale extends LocaleName<Resources> = LocaleName<Resources>>(
    request: LingvaResourceLoaderRequest<Resources, Locale>,
    context: LingvaResourceLoaderContext
  ) => Promise<Partial<Record<TranslationKey<Resources>, LingvaMessage>>>;
}

export interface LingvaDeliveryCacheConfig {
  memory?: boolean;
  storage?: boolean;
  ttl?: number;
  strategy?: LingvaDeliveryCacheStrategy;
}

export interface LingvaCdnDeliveryConfig {
  mode: typeof LINGVA_DELIVERY_MODES.cdn;
  url: string;
  headers?: Record<string, string>;
  apiKeyHeader?: string;
  projectIdHeader?: string;
  localeQueryParam?: string;
  keysQueryParam?: string;
  projectIdQueryParam?: string;
  timeoutMs?: number;
  cache?: LingvaDeliveryCacheConfig;
}

export interface LingvaLocalDeliveryConfig {
  mode: typeof LINGVA_DELIVERY_MODES.local;
  path: string;
  cache?: LingvaDeliveryCacheConfig;
}

export type LingvaDeliveryConfig = LingvaCdnDeliveryConfig | LingvaLocalDeliveryConfig;

export interface LingvaEditorRuntimeConfig {
  enabled?: boolean;
  canSave?: boolean;
  mode?: (typeof LINGVA_RUNTIME_MODES)[keyof typeof LINGVA_RUNTIME_MODES];
  saveUrl?: string;
  studioUrl?: string;
}

export interface LingvaConfig<Resources extends LingvaResources = LingvaResources> {
  apiKey?: string;
  apiUrl?: string;
  projectId?: string;
  environment?: string;
  locales?: readonly LocaleName<Resources>[];
  defaultLocale?: LocaleName<Resources>;
  locale?: LocaleName<Resources>;
  fallbackLocale?: LocaleName<Resources>;
  resources?: Resources;
  loader?: LingvaResourceLoader<Resources>;
  editor?: LingvaEditorRuntimeConfig;
  keyMetadata?: LingvaProjectKeyMetadata<Resources>;
  metadataFile?: string;
}

export interface LingvaRuntimeConfig<Resources extends LingvaResources = LingvaResources> extends Omit<
  LingvaConfig<Resources>,
  'resources' | 'loader'
> {
  project?: LingvaProject<Resources>;
  resources?: Resources;
  loader?: LingvaResourceLoader<Resources>;
  environment?: string;
  delivery?: LingvaDeliveryConfig;
  translationFiles?: string;
  generatedProjectFile?: string;
}

export interface LingvaRemoteRuntimeSetup<Resources extends LingvaResources = LingvaResources>
  extends Omit<LingvaRuntimeConfig<Resources>, 'loader' | 'delivery'>, LingvaRuntimeLoaderFactoryOptions<Resources> {
  mode: typeof LINGVA_RUNTIME_MODES.remote;
  remote?: Omit<Partial<LingvaCdnDeliveryConfig>, 'mode'>;
}

export interface LingvaLocalRuntimeSetup<Resources extends LingvaResources = LingvaResources>
  extends Omit<LingvaRuntimeConfig<Resources>, 'loader' | 'delivery'>, LingvaRuntimeLoaderFactoryOptions<Resources> {
  mode: typeof LINGVA_RUNTIME_MODES.local;
  local?: Omit<Partial<LingvaLocalDeliveryConfig>, 'mode'>;
}

export type LingvaRuntimeSetup<Resources extends LingvaResources = LingvaResources> =
  | LingvaRemoteRuntimeSetup<Resources>
  | LingvaLocalRuntimeSetup<Resources>;

export interface ResolvedLingvaRuntimeSetup<Resources extends LingvaResources = LingvaResources> {
  config: LingvaRuntimeConfig<Resources>;
  loaderFactoryOptions: LingvaRuntimeLoaderFactoryOptions<Resources>;
}

export interface LingvaHttpLoaderOptions<Resources extends LingvaResources = LingvaResources> {
  url: string;
  cache?: LingvaDeliveryCacheConfig;
  headers?: Record<string, string>;
  apiKey?: string;
  apiKeyHeader?: string;
  projectIdHeader?: string;
  localeQueryParam?: string;
  keysQueryParam?: string;
  projectIdQueryParam?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
  parseResponse?: (
    response: Response,
    request: LingvaResourceLoaderRequest<Resources>,
    context: LingvaResourceLoaderContext
  ) => Promise<unknown>;
  decode?: (
    payload: unknown,
    request: LingvaResourceLoaderRequest<Resources>,
    context: LingvaResourceLoaderContext
  ) =>
    | Promise<Partial<Record<TranslationKey<Resources>, LingvaMessage>>>
    | Partial<Record<TranslationKey<Resources>, LingvaMessage>>;
}

export interface LingvaLocalLoaderOptions<Resources extends LingvaResources = LingvaResources> {
  path: string;
  cache?: LingvaDeliveryCacheConfig;
  readFile: (path: string) => Promise<string | Uint8Array>;
  parseFile?: (
    input: string | Uint8Array,
    filePath: string,
    request: LingvaResourceLoaderRequest<Resources>,
    context: LingvaResourceLoaderContext
  ) => Promise<unknown>;
  decode?: (
    payload: unknown,
    request: LingvaResourceLoaderRequest<Resources>,
    context: LingvaResourceLoaderContext
  ) =>
    | Promise<Partial<Record<TranslationKey<Resources>, LingvaMessage>>>
    | Partial<Record<TranslationKey<Resources>, LingvaMessage>>;
}

export interface LingvaRuntimeLoaderFactoryOptions<Resources extends LingvaResources = LingvaResources> {
  fetcher?: typeof fetch;
  readFile?: (path: string) => Promise<string | Uint8Array>;
  parseResponse?: LingvaHttpLoaderOptions<Resources>['parseResponse'];
  parseFile?: LingvaLocalLoaderOptions<Resources>['parseFile'];
  decode?: (
    payload: unknown,
    request: LingvaResourceLoaderRequest<Resources>,
    context: LingvaResourceLoaderContext
  ) =>
    | Promise<Partial<Record<TranslationKey<Resources>, LingvaMessage>>>
    | Partial<Record<TranslationKey<Resources>, LingvaMessage>>;
}

export interface LingvaMessageVariantSelector {
  id?: string;
  tone?: string;
  mood?: string;
  intonation?: string;
  label?: string;
}

export interface TranslationOptions<
  Resources extends LingvaResources = LingvaResources,
  Key extends TranslationKey<Resources> = TranslationKey<Resources>,
> {
  locale?: LocaleName<Resources>;
  variables?: TranslationVariables<Resources, Key>;
  defaultValue?: string;
  fallback?: LocaleName<Resources> | false;
  signal?: AbortSignal;
  variant?: TranslationVariant<Resources, Key>;
}

export interface MissingTranslationContext<
  Resources extends LingvaResources = LingvaResources,
  Key extends TranslationKey<Resources> = TranslationKey<Resources>,
> {
  key: Key;
  locale: LocaleName<Resources>;
  fallbackLocale?: LocaleName<Resources>;
}

export interface LingvaProjectDefinition<
  Resources extends LingvaResources = LingvaResources,
  DefaultLocale extends LocaleName<Resources> = LocaleName<Resources>,
  FallbackLocale extends LocaleName<Resources> | undefined = LocaleName<Resources> | undefined,
> {
  resources: Resources;
  defaultLocale: DefaultLocale;
  fallbackLocale?: FallbackLocale;
  keyMetadata?: LingvaProjectKeyMetadata<Resources>;
  apiKey?: string;
  apiUrl?: string;
  projectId?: string;
  environment?: string;
}

export interface LingvaProject<
  Resources extends LingvaResources = LingvaResources,
  DefaultLocale extends LocaleName<Resources> = LocaleName<Resources>,
  FallbackLocale extends LocaleName<Resources> | undefined = LocaleName<Resources> | undefined,
> extends LingvaProjectDefinition<Resources, DefaultLocale, FallbackLocale> {
  getKeyMetadata: <Key extends TranslationKey<Resources>>(key: Key) => LingvaKeyMetadata | undefined;
  getKeyMetadataMap: () => LingvaProjectKeyMetadata<Resources>;
  getConfig: (
    overrides?: Omit<LingvaConfig<Resources>, 'resources' | 'locale' | 'fallbackLocale'> & {
      locale?: LocaleName<Resources>;
      fallbackLocale?: LocaleName<Resources>;
    }
  ) => LingvaConfig<Resources>;
  createClient: (
    overrides?: Omit<LingvaConfig<Resources>, 'resources' | 'locale' | 'fallbackLocale'> & {
      locale?: LocaleName<Resources>;
      fallbackLocale?: LocaleName<Resources>;
    }
  ) => LingvaClient<Resources>;
}

export type LingvaProjectValidationSeverity = LingvaValidationSeverity;

export interface LingvaProjectValidationIssue<
  Resources extends LingvaResources = LingvaResources,
  Key extends TranslationKey<Resources> = TranslationKey<Resources>,
> {
  code: LingvaValidationIssueCode;
  severity: LingvaProjectValidationSeverity;
  message: string;
  key?: Key;
  locale?: LocaleName<Resources>;
}

export interface LingvaProjectValidationResult<Resources extends LingvaResources = LingvaResources> {
  valid: boolean;
  issues: LingvaProjectValidationIssue<Resources>[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

export interface LingvaValidationReportOptions {
  format?: LingvaSerializationFormat;
  includeSummary?: boolean;
}

export interface LingvaProjectManifestTranslationEntry {
  locale: LingvaLocale;
  value?: LingvaMessage;
  missing: boolean;
  isDefaultLocale: boolean;
}

export interface LingvaProjectManifestEntry {
  key: string;
  namespace?: string;
  variables: string[];
  metadata?: LingvaKeyMetadata;
  translations: LingvaProjectManifestTranslationEntry[];
}

export interface LingvaProjectManifest {
  projectId?: string;
  defaultLocale: LingvaLocale;
  fallbackLocale?: LingvaLocale;
  locales: LingvaLocale[];
  keys: string[];
  entries: LingvaProjectManifestEntry[];
}

export interface LingvaProjectManifestFormatOptions {
  format?: LingvaSerializationFormat;
  includeSummary?: boolean;
}

export interface LingvaProjectBundleEntry {
  key: string;
  value: string;
  sourceLocale: LingvaLocale;
  fallback: boolean;
  variables: string[];
  namespace?: string;
  variants?: LingvaMessageVariants;
}

export interface LingvaProjectBundle {
  schemaVersion: typeof LINGVA_BUNDLE_SCHEMA_VERSION;
  projectId?: string;
  environment?: string;
  locale: LingvaLocale;
  defaultLocale: LingvaLocale;
  fallbackLocale?: LingvaLocale;
  generatedAt: string;
  keyCount: number;
  fallbackKeys: string[];
  messages: Record<string, string>;
  variants?: Record<string, LingvaMessageVariants>;
  sources: Record<string, LingvaLocale>;
  variables: Record<string, string[]>;
  metadata?: Record<string, LingvaKeyMetadata>;
  entries: LingvaProjectBundleEntry[];
}

export interface LingvaProjectBundleOptions {
  locale: LingvaLocale;
  includeMetadata?: boolean;
}

export interface LingvaProjectBundleFormatOptions {
  format?: LingvaSerializationFormat;
  includeSummary?: boolean;
}

export interface LingvaPublishArtifactBundleDescriptor {
  locale: LingvaLocale;
  fileName: string;
  keyCount: number;
  fallbackKeyCount: number;
}

export interface LingvaPublishArtifactsManifest {
  projectId?: string;
  environment?: string;
  defaultLocale: LingvaLocale;
  fallbackLocale?: LingvaLocale;
  generatedAt: string;
  locales: LingvaLocale[];
  bundles: LingvaPublishArtifactBundleDescriptor[];
}

export interface LingvaPublishArtifacts<Bundle extends LingvaProjectBundle = LingvaProjectBundle> {
  manifest: LingvaPublishArtifactsManifest;
  bundles: Record<string, Bundle>;
}

export interface LingvaPublishArtifactsOptions {
  locales?: LingvaLocale[];
  includeMetadata?: boolean;
  fileNameTemplate?: string;
}

export interface LingvaPublishArtifactsFormatOptions {
  format?: LingvaSerializationFormat;
  includeSummary?: boolean;
}

export interface LingvaWorkflowSummaryEntry {
  key: string;
  status: LingvaWorkflowSummaryStatus;
  translator?: string;
  reviewer?: string;
}

export interface LingvaWorkflowSummary {
  totalKeys: number;
  statusCounts: Record<LingvaWorkflowSummaryStatus, number>;
  translatorPendingKeys: string[];
  reviewerPendingKeys: string[];
  approvalPendingKeys: string[];
  approvedKeys: string[];
  entries: LingvaWorkflowSummaryEntry[];
}

export interface LingvaWorkflowSummaryFormatOptions {
  format?: LingvaSerializationFormat;
  includeSummary?: boolean;
}

export interface LingvaProjectTypeScriptModuleOptions {
  includeMetadata?: boolean;
  includeSummaryComment?: boolean;
}

export interface LingvaProjectHelpersModuleOptions {
  includeMetadata?: boolean;
  includeSummaryComment?: boolean;
}

export type LingvaValidationFailOn =
  | LingvaProjectValidationSeverity
  | (typeof LINGVA_VALIDATION_FAIL_MODES)[keyof typeof LINGVA_VALIDATION_FAIL_MODES];
