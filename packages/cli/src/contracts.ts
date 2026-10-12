import type {
  LingvaMessage,
  LingvaMessageVariant,
  LingvaDeliverySource,
  LingvaFramework,
  LingvaSetupTarget,
  LingvaOperationStatus,
  LingvaKeyMetadata,
  LingvaProjectBundle,
  LingvaProjectBundleFormatOptions,
  LingvaProject,
  LingvaProjectManifest,
  LingvaRemoteAuthoringDraftRecord,
  LingvaRemoteAuthoringDraftPayload,
  LingvaRemoteAuthoringDraftReviewStatus,
  LingvaRemoteAuthoringDraftStatus,
  LingvaPublishArtifacts,
  LingvaPublishArtifactsFormatOptions,
  LingvaProjectValidationSeverity,
  LingvaResources,
  LingvaRuntimeConfig,
  LingvaRuntimeMode,
  LingvaSerializationFormat,
  LingvaValidationFailOn,
  LingvaValidationReportOptions,
  LingvaWorkflowSummary,
  LingvaWorkflowSummaryFormatOptions,
} from '@lingva/core';

/**
 * Shared options for `lingva validate`.
 */
export interface ValidateProjectOptions extends LingvaValidationReportOptions {
  cwd?: string;
  failOn?: LingvaValidationFailOn;
  outputFile?: string;
  glob?: string;
  onlyCodes?: string[];
  ignoreCodes?: string[];
  maxIssues?: number;
}

export type LingvaCliValidationPolicy = Omit<ValidateProjectOptions, 'cwd' | 'outputFile'>;

/**
 * Shared options for `lingva extract`.
 */
export interface ExtractLingvaKeysOptions {
  cwd?: string;
  format?: LingvaSerializationFormat;
  outputFile?: string;
  includeSummary?: boolean;
  projectFile?: string;
  extensions?: string[];
  exclude?: string[];
  failOn?: 'missing' | 'unused' | 'any' | 'none';
}

export type LingvaCliExtractionPolicy = Omit<ExtractLingvaKeysOptions, 'cwd' | 'outputFile' | 'projectFile'>;

export interface LingvaCliConfig {
  apiUrl?: string;
  apiKeyEnv?: string;
  validate?: LingvaCliValidationPolicy;
  validatePolicies?: Record<string, LingvaCliValidationPolicy>;
  extract?: LingvaCliExtractionPolicy;
  extractPolicies?: Record<string, LingvaCliExtractionPolicy>;
  publish?: {
    apiUrl?: string;
    authToken?: string;
    outputDir?: string;
    includeMetadata?: boolean;
  };
  invalidate?: {
    apiUrl?: string;
    authToken?: string;
    source?: LingvaDeliverySource;
  };
  authoring?: {
    apiUrl?: string;
    authToken?: string;
    environment?: string;
  };
}

export interface LingvaCliAuthEnvironment {
  LINGVA_AUTH_AUTHORIZE_URL?: string;
  LINGVA_AUTH_CLIENT_ID?: string;
  LINGVA_AUTH_DEVICE_URL?: string;
  LINGVA_AUTH_ISSUER_URL?: string;
  LINGVA_AUTH_SCOPES?: string;
  LINGVA_AUTH_TOKEN_URL?: string;
  LINGVA_PLATFORM_URL?: string;
}

export interface LingvaCliCredentials {
  accessToken?: string;
  apiKey?: string;
  apiKeyPreview?: string;
  apiUrl?: string;
  clientId?: string;
  expiresAt?: string;
  idToken?: string;
  obtainedAt: string;
  profile?: {
    email?: string;
    subject?: string;
  };
  platformUrl?: string;
  refreshToken?: string;
  scope?: string;
  projectId?: string;
  tokenType?: string;
  tokenUrl?: string;
}

export interface LingvaCliAuthConfig {
  authorizeUrl: string;
  clientId: string;
  deviceUrl: string;
  scopes: string[];
  tokenUrl: string;
}

export interface LingvaCliAuthLoginOptions {
  authorizeUrl?: string;
  browser?: boolean;
  clientId?: string;
  credentialsFile?: string;
  device?: boolean;
  deviceUrl?: string;
  environment?: LingvaCliAuthEnvironment & Record<string, string | undefined>;
  issuerUrl?: string;
  port?: number;
  platformUrl?: string;
  scopes?: string[];
  tokenUrl?: string;
}

export interface LingvaCliAuthLoginOutput {
  credentialsFile: string;
  expiresAt?: string;
  profile?: LingvaCliCredentials['profile'];
  report: string;
}

export interface LingvaCliAuthApiKeyOptions {
  apiKey: string;
  apiUrl?: string;
  credentialsFile?: string;
  projectId?: string;
}

export interface LingvaCliAuthApiKeyOutput {
  apiKeyPreview: string;
  credentialsFile: string;
  projectId?: string;
  report: string;
}

export interface LingvaCliAuthStatusOutput {
  authenticated: boolean;
  authMethod?: 'api-key' | 'oauth';
  apiKeyPreview?: string;
  credentialsFile: string;
  expiresAt?: string;
  profile?: LingvaCliCredentials['profile'];
  projectId?: string;
  report: string;
}

export interface LingvaCliAuthLogoutOutput {
  credentialsFile: string;
  report: string;
}

export interface CheckLingvaCliUpdateOptions {
  currentVersion: string;
  format?: LingvaSerializationFormat;
}

export interface CheckLingvaCliUpdateOutput {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  installCommand?: string;
  report: string;
}

/**
 * Standard report shape returned by validation commands.
 */
export interface ValidateProjectOutput {
  report: string;
  valid: boolean;
  shouldFail: boolean;
  outputFile?: string;
}

/**
 * Aggregate report shape returned by batch validation.
 */
export interface ValidateProjectsOutput extends ValidateProjectOutput {
  projectCount: number;
  severityCounts: Record<LingvaProjectValidationSeverity, number>;
  codeCounts: Record<string, number>;
}

export interface GenerateProjectManifestOptions {
  cwd?: string;
  format?: LingvaSerializationFormat;
  outputFile?: string;
  includeSummary?: boolean;
}

export interface GenerateProjectManifestOutput {
  manifest: LingvaProjectManifest;
  report: string;
  outputFile?: string;
}

export interface GenerateProjectBundleOptions extends LingvaProjectBundleFormatOptions {
  cwd?: string;
  outputFile?: string;
  locale: string;
  includeMetadata?: boolean;
}

export interface GenerateProjectBundleOutput {
  bundle: LingvaProjectBundle;
  report: string;
  outputFile?: string;
}

export interface PublishLingvaProjectOptions extends LingvaPublishArtifactsFormatOptions {
  cwd?: string;
  outputDir?: string;
  locales?: string[];
  includeMetadata?: boolean;
  apiUrl?: string;
  authToken?: string;
  baseRevision?: string | null;
  force?: boolean;
}

export interface PublishLingvaProjectOutput {
  artifacts: LingvaPublishArtifacts;
  report: string;
  outputDir?: string;
  hostedPublish?: {
    apiUrl: string;
    publishId: string;
    projectId: string;
    environment: string;
    publishedAt: string;
    manifestKey: string;
    bundleKeys: Record<string, string>;
  };
}

export interface InvalidateLingvaProjectOptions {
  cwd?: string;
  apiUrl?: string;
  authToken?: string;
  environment?: string;
  source?: LingvaDeliverySource;
  reason?: string;
  format?: LingvaSerializationFormat;
}

export interface InvalidateLingvaProjectOutput {
  report: string;
  invalidation: {
    apiUrl: string;
    invalidationId: string;
    projectId: string;
    environment: string;
    publishId: string;
    manifestKey: string;
    requestedAt: string;
    source: LingvaDeliverySource;
    reason?: string;
    status: LingvaOperationStatus;
  };
}

export interface PushLingvaProjectOptions extends PublishLingvaProjectOptions {
  invalidate?: boolean;
  invalidateApiUrl?: string;
  invalidateAuthToken?: string;
  invalidateEnvironment?: string;
  invalidateSource?: LingvaDeliverySource;
  invalidateReason?: string;
}

export interface PushLingvaProjectOutput {
  publish: PublishLingvaProjectOutput;
  invalidation?: InvalidateLingvaProjectOutput;
  report: string;
}

export interface LingvaInitFile {
  path: string;
  content: string;
}

export interface InitializeLingvaProjectOptions {
  cwd?: string;
  mode?: LingvaRuntimeMode;
  framework?: LingvaFramework;
  sdk?: LingvaSetupTarget;
  ci?: 'github';
  configFile?: string;
  locales?: string[];
  defaultLocale?: string;
  fallbackLocale?: string;
  projectId?: string;
  environment?: string;
  apiUrl?: string;
  bundleUrl?: string;
  apiKeyEnv?: string;
  localesDir?: string;
  translationFiles?: string;
  providerFile?: string;
  force?: boolean;
  dryRun?: boolean;
  format?: LingvaSerializationFormat;
  noAuth?: boolean;
  nonInteractive?: boolean;
  platformUrl?: string;
}

export interface InitializeLingvaProjectOutput {
  mode: LingvaRuntimeMode;
  framework?: LingvaFramework;
  sdk?: LingvaSetupTarget;
  ci?: 'github';
  configFile: string;
  files: LingvaInitFile[];
  nextSteps: string[];
  written: boolean;
  report: string;
}

export interface SyncLingvaLocalFilesOptions {
  cwd?: string;
  format?: LingvaSerializationFormat;
  write?: boolean;
  check?: boolean;
}

export interface SyncLingvaLocalFilesOutput {
  configFile: string;
  defaultLocale: string;
  locales: string[];
  files: Array<{
    locale: string;
    filePath: string;
    missingKeys: number;
    missingVariants: number;
    extraVariants: number;
    variantMetadataMismatches: number;
    written: boolean;
  }>;
  generatedProjectFile: string;
  hasDrift: boolean;
  report: string;
}

export interface ScaffoldLingvaMetadataOptions {
  cwd?: string;
  format?: LingvaSerializationFormat;
  outputFile?: string;
  write?: boolean;
  defaultStatus?: LingvaKeyMetadata['status'];
}

export interface ScaffoldLingvaMetadataOutput {
  configFile: string;
  defaultLocale: string;
  outputFile: string;
  keyCount: number;
  added: number;
  missingKeys: string[];
  preserved: number;
  written: boolean;
  metadata: Record<string, LingvaKeyMetadata>;
  hasDrift: boolean;
  report: string;
}

export interface CheckLingvaLocalProjectOptions extends ValidateProjectOptions {
  cwd?: string;
  outputFile?: string;
}

export interface CheckLingvaLocalProjectOutput {
  configFile: string;
  passed: boolean;
  sync: SyncLingvaLocalFilesOutput;
  validation: ValidateProjectOutput;
  report: string;
  outputFile?: string;
}

export interface LingvaStudioNode {
  key: string;
  path: string;
  value?: LingvaMessage;
  locales: Record<
    string,
    {
      value?: LingvaMessage;
      missing: boolean;
    }
  >;
  children: LingvaStudioNode[];
}

export interface LingvaStudioVariantDraft extends LingvaMessageVariant {
  path: string;
}

export interface GenerateLingvaStudioOptions {
  cwd?: string;
  format?: 'html' | 'json';
  outputFile?: string;
}

export interface GenerateLingvaStudioOutput {
  configFile: string;
  defaultLocale: string;
  locales: string[];
  summary: {
    totalKeys: number;
    localeCoverage: Record<
      string,
      {
        translated: number;
        missing: number;
      }
    >;
  };
  tree: LingvaStudioNode[];
  report: string;
  outputFile?: string;
}

export interface ApplyLingvaLocalDictionaryOptions {
  cwd?: string;
  locale: string;
  inputFile: string;
  sync?: boolean;
  format?: LingvaSerializationFormat;
}

export interface ApplyLingvaLocalDictionaryOutput {
  configFile: string;
  locale: string;
  filePath: string;
  inputFile: string;
  synced: boolean;
  generatedProjectFile?: string;
  report: string;
}

export interface ApproveLingvaDraftOptions {
  cwd?: string;
  draftFile?: string;
  draftId?: string;
  apiUrl?: string;
  authToken?: string;
  environment?: string;
  hostedDraftLimit?: number;
  markHostedDraftApproved?: boolean;
  approvedBy?: string;
  push?: boolean;
  forcePush?: boolean;
  pushOutputDir?: string;
  publishApiUrl?: string;
  publishAuthToken?: string;
  publishLocales?: string[];
  invalidate?: boolean;
  invalidateApiUrl?: string;
  invalidateAuthToken?: string;
  invalidateEnvironment?: string;
  invalidateSource?: LingvaDeliverySource;
  invalidateReason?: string;
  includeMetadata?: boolean;
  format?: LingvaSerializationFormat;
  sync?: boolean;
  dryRun?: boolean;
}

export interface ApproveLingvaDraftOutput {
  configFile: string;
  draft: LingvaRemoteAuthoringDraftPayload;
  filePath: string;
  synced: boolean;
  dryRun: boolean;
  hostedApproval?: {
    ok: boolean;
    draftId: string;
    status: LingvaRemoteAuthoringDraftStatus;
    approvedAt?: string;
  };
  push?: PushLingvaProjectOutput;
  generatedProjectFile?: string;
  report: string;
}

export interface ListHostedLingvaDraftsOptions {
  cwd?: string;
  apiUrl?: string;
  authToken?: string;
  environment?: string;
  locale?: string;
  key?: string;
  limit?: number;
  nextToken?: string;
  status?: LingvaRemoteAuthoringDraftReviewStatus;
  format?: LingvaSerializationFormat;
  outputDir?: string;
}

export interface ListHostedLingvaDraftsOutput {
  configFile: string;
  projectId: string;
  environment: string;
  status: LingvaRemoteAuthoringDraftReviewStatus;
  drafts: LingvaRemoteAuthoringDraftRecord[];
  nextToken?: string;
  outputFiles: string[];
  report: string;
}

export interface GenerateProjectWorkflowOptions extends LingvaWorkflowSummaryFormatOptions {
  cwd?: string;
  outputFile?: string;
}

export interface GenerateProjectWorkflowOutput {
  summary: LingvaWorkflowSummary;
  report: string;
  outputFile?: string;
}

export interface GenerateProjectTypesOptions {
  cwd?: string;
  outputFile?: string;
  includeMetadata?: boolean;
  includeSummaryComment?: boolean;
}

export interface GenerateProjectTypesOutput {
  manifest: LingvaProjectManifest;
  report: string;
  outputFile?: string;
}

export interface GenerateProjectHelpersOptions {
  cwd?: string;
  outputFile?: string;
  includeMetadata?: boolean;
  includeSummaryComment?: boolean;
}

export interface GenerateProjectHelpersOutput {
  manifest: LingvaProjectManifest;
  report: string;
  outputFile?: string;
}

export interface ExportLingvaProjectOptions {
  cwd?: string;
  outputFile?: string;
}

export interface ExportLingvaProjectOutput {
  payload: Record<string, unknown>;
  report: string;
  outputFile?: string;
}

export interface ImportLingvaResourcesOptions {
  cwd?: string;
  outputFile?: string;
  projectFile?: string;
}

export interface ImportLingvaResourcesOutput {
  payload: Record<string, unknown>;
  report: string;
  outputFile?: string;
}

export interface PullLingvaBundlesOptions {
  cwd?: string;
  apiUrl?: string;
  authToken?: string;
  outputFile?: string;
  locales?: string[];
  format?: LingvaSerializationFormat;
  includeSummary?: boolean;
}

/**
 * Output contract for repository-backed bundle materialization.
 */
export interface PullLingvaBundlesOutput {
  files: string[];
  locales: string[];
  mode: LingvaRuntimeMode;
  report: string;
}

export interface SyncLingvaLocalOptions {
  cwd?: string;
  format?: LingvaSerializationFormat;
  write?: boolean;
}

export interface SyncLingvaLocalOutput {
  configFile: string;
  defaultLocale: string;
  locales: string[];
  files: Array<{
    locale: string;
    filePath: string;
    missingKeys: number;
    written: boolean;
  }>;
  report: string;
}

/**
 * Output contract for key extraction and audit reporting.
 */
export interface ExtractLingvaKeysOutput {
  scannedFiles: string[];
  keys: string[];
  matchedKeys: string[];
  missingKeys: string[];
  unusedProjectKeys: string[];
  occurrences: Record<string, Array<{ file: string; line: number }>>;
  shouldFail: boolean;
  report: string;
  outputFile?: string;
}

export interface LoadedLingvaProjectModule {
  default?: unknown;
  project?: unknown;
  config?: LingvaRuntimeConfig<LingvaResources> | { cli?: LingvaCliConfig };
}

export type AnyLingvaProject = LingvaProject<LingvaResources>;
