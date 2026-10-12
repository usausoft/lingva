/**
 * Canonical string contracts shared by Lingva runtimes, the platform BFF,
 * infrastructure verification, and CLI tooling.
 *
 * String literals belong here when they select behavior or cross a process
 * boundary. Keeping them named prevents independently typed unions and runtime
 * comparisons from drifting apart.
 */
export const LINGVA_BOOLEAN_STRINGS = {
  false: 'false',
  true: 'true',
} as const;

export const LINGVA_DEPLOYMENT_STAGES = {
  development: 'dev',
  production: 'prod',
  staging: 'stage',
} as const;

export const LINGVA_RUNTIME_MODES = {
  local: 'local',
  remote: 'remote',
} as const;

/** Consumer application targets supported by the setup CLI. */
export const LINGVA_FRAMEWORKS = {
  angular: 'angular',
  next: 'next',
  react: 'react',
  svelte: 'svelte',
  vanilla: 'vanilla',
  vue: 'vue',
} as const;

/** All consumer SDK targets understood by setup surfaces and the CLI. */
export const LINGVA_SETUP_TARGETS = {
  ...LINGVA_FRAMEWORKS,
  flutter: 'flutter',
  kotlin: 'kotlin',
  python: 'python',
  swift: 'swift',
} as const;

export const LINGVA_DELIVERY_MODES = {
  cdn: 'cdn',
  local: LINGVA_RUNTIME_MODES.local,
} as const;

export const LINGVA_DELIVERY_CACHE_STRATEGIES = {
  backgroundRevalidate: 'background-revalidate',
  buildTime: 'build-time',
  manual: 'manual',
  startup: 'startup',
} as const;

export const LINGVA_WORKFLOW_STATUSES = {
  approved: 'approved',
  draft: 'draft',
  reviewed: 'reviewed',
  translated: 'translated',
} as const;

export const LINGVA_WORKFLOW_SUMMARY_STATUSES = {
  ...LINGVA_WORKFLOW_STATUSES,
  untracked: 'untracked',
} as const;

export const LINGVA_OPERATION_STATUSES = {
  completed: 'completed',
  inProgress: 'in_progress',
  queued: 'queued',
} as const;

export const LINGVA_LOCAL_USER_ACTIONS = {
  authenticate: 'authenticateUser',
  create: 'createUser',
  delete: 'deleteUser',
  disable: 'disableUser',
  list: 'listUsers',
  update: 'updateUser',
} as const;

export const LINGVA_LOCAL_USER_STATUSES = {
  active: 'active',
  disabled: 'disabled',
} as const;

export const LINGVA_DELIVERY_SOURCES = {
  dashboard: 'dashboard',
  manual: 'manual',
  repository: 'repository',
} as const;

export const LINGVA_VALIDATION_SEVERITIES = {
  error: 'error',
  info: 'info',
  warning: 'warning',
} as const;

export const LINGVA_VALIDATION_FAIL_MODES = {
  none: 'none',
  variantDrift: 'variant-drift',
} as const;

export const LINGVA_VALIDATION_ISSUE_CODES = {
  extraLocaleVariant: 'extra_locale_variant',
  invalidTranslationKey: 'invalid_translation_key',
  invalidTranslationContract: 'invalid_translation_contract',
  missingDefaultTranslation: 'missing_default_translation',
  missingKeyDescription: 'missing_key_description',
  missingKeyMetadata: 'missing_key_metadata',
  missingLocaleTranslation: 'missing_locale_translation',
  missingLocaleVariant: 'missing_locale_variant',
  missingWorkflowStatus: 'missing_workflow_status',
  namespaceMismatch: 'namespace_mismatch',
  reviewedKeyMissingReviewer: 'reviewed_key_missing_reviewer',
  translatedKeyMissingTranslator: 'translated_key_missing_translator',
  translationContractMismatch: 'translation_contract_mismatch',
  variantMetadataMismatch: 'variant_metadata_mismatch',
} as const;

export const LINGVA_SERIALIZATION_FORMATS = {
  json: 'json',
  text: 'text',
} as const;

/** Version of the public locale-bundle JSON contract consumed by all SDKs. */
export const LINGVA_BUNDLE_SCHEMA_VERSION = 1 as const;

export const LINGVA_MESSAGE_KINDS = {
  missing: 'missing',
  text: 'text',
  variants: 'variants',
} as const;

export const LINGVA_HTTP_METHODS = {
  delete: 'DELETE',
  get: 'GET',
  head: 'HEAD',
  options: 'OPTIONS',
  patch: 'PATCH',
  post: 'POST',
  put: 'PUT',
} as const;

export const LINGVA_HTTP_HEADERS = {
  accept: 'accept',
  authorization: 'authorization',
  cacheControl: 'cache-control',
  contentType: 'content-type',
  amazonTarget: 'x-amz-target',
  apiKey: 'x-api-key',
  projectId: 'x-lingva-project',
  revision: 'x-lingva-revision',
} as const;

export const LINGVA_DELIVERY_QUERY_PARAMS = {
  keys: 'keys',
  locale: 'locale',
  projectId: 'projectId',
} as const;

export const LINGVA_MEDIA_TYPES = {
  formUrlEncoded: 'application/x-www-form-urlencoded',
  html: 'text/html',
  json: 'application/json',
  jsonUtf8: 'application/json; charset=utf-8',
  amazonJson: 'application/x-amz-json-1.1',
  text: 'text/plain',
} as const;

export const LINGVA_CACHE_DIRECTIVES = {
  noStore: 'no-store',
} as const;

export type LingvaDeploymentStage = (typeof LINGVA_DEPLOYMENT_STAGES)[keyof typeof LINGVA_DEPLOYMENT_STAGES];
export type LingvaRuntimeMode = (typeof LINGVA_RUNTIME_MODES)[keyof typeof LINGVA_RUNTIME_MODES];
export type LingvaFramework = (typeof LINGVA_FRAMEWORKS)[keyof typeof LINGVA_FRAMEWORKS];
export type LingvaSetupTarget = (typeof LINGVA_SETUP_TARGETS)[keyof typeof LINGVA_SETUP_TARGETS];
export type LingvaLocalRuntimeMode = typeof LINGVA_RUNTIME_MODES.local;
export type LingvaDeliveryMode = (typeof LINGVA_DELIVERY_MODES)[keyof typeof LINGVA_DELIVERY_MODES];
export type LingvaDeliveryCacheStrategy =
  (typeof LINGVA_DELIVERY_CACHE_STRATEGIES)[keyof typeof LINGVA_DELIVERY_CACHE_STRATEGIES];
export type LingvaWorkflowStatus = (typeof LINGVA_WORKFLOW_STATUSES)[keyof typeof LINGVA_WORKFLOW_STATUSES];
export type LingvaWorkflowSummaryStatus =
  (typeof LINGVA_WORKFLOW_SUMMARY_STATUSES)[keyof typeof LINGVA_WORKFLOW_SUMMARY_STATUSES];
export type LingvaOperationStatus = (typeof LINGVA_OPERATION_STATUSES)[keyof typeof LINGVA_OPERATION_STATUSES];
export type LingvaDeliverySource = (typeof LINGVA_DELIVERY_SOURCES)[keyof typeof LINGVA_DELIVERY_SOURCES];
export type LingvaValidationSeverity = (typeof LINGVA_VALIDATION_SEVERITIES)[keyof typeof LINGVA_VALIDATION_SEVERITIES];
export type LingvaValidationIssueCode =
  (typeof LINGVA_VALIDATION_ISSUE_CODES)[keyof typeof LINGVA_VALIDATION_ISSUE_CODES];
export type LingvaSerializationFormat =
  (typeof LINGVA_SERIALIZATION_FORMATS)[keyof typeof LINGVA_SERIALIZATION_FORMATS];
