import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  LINGVA_DELIVERY_MODES,
  LINGVA_DELIVERY_SOURCES,
  LINGVA_FRAMEWORKS,
  LINGVA_HTTP_HEADERS,
  LINGVA_HTTP_METHODS,
  LINGVA_MEDIA_TYPES,
  LINGVA_RUNTIME_MODES,
  LINGVA_SERIALIZATION_FORMATS,
  LINGVA_HOSTED_CONTROL_PLANE_ACTIONS,
  LINGVA_REMOTE_AUTHORING_ACTIONS,
  LINGVA_REMOTE_AUTHORING_DRAFT_REVIEW_STATUSES,
  LINGVA_REMOTE_AUTHORING_DRAFT_STATUSES,
  createLingvaProjectBundle,
  createLingvaProjectManifest,
  createLingvaPublishArtifacts,
  createLingvaWorkflowSummary,
  defineLingvaProject,
  formatLingvaProjectBundle,
  formatLingvaWorkflowSummary,
  formatLingvaProjectHelpersModule,
  formatLingvaProjectManifest,
  formatLingvaProjectTypeScriptModule,
  formatLingvaPublishArtifacts,
  formatLingvaValidationReport,
  applyLingvaTranslationEdit,
  createLingvaRemoteAuthoringDraftPayload,
  type LingvaRemoteAuthoringDraftStatus,
  parseLingvaRemoteAuthoringDraftsResponse,
  type LingvaConfig,
  type LingvaFramework,
  type LingvaSetupTarget,
  type LingvaDictionary,
  type LingvaKeyMetadata,
  type LingvaMessage,
  type LingvaMessageVariant,
  type LingvaMessageVariants,
  type LingvaProjectBundle,
  type LingvaPublishArtifacts,
  shouldFailLingvaValidation,
  validateLingvaProject,
  type LingvaProjectValidationIssue,
  type LingvaProjectValidationSeverity,
  type LingvaResources,
  type LingvaRuntimeConfig,
  type LingvaRuntimeMode,
  DEFAULT_REMOTE_BUNDLE_PATH_TEMPLATE,
} from '@lingva/core';
import type {
  ApplyLingvaLocalDictionaryOptions,
  ApplyLingvaLocalDictionaryOutput,
  ApproveLingvaDraftOptions,
  ApproveLingvaDraftOutput,
  AnyLingvaProject,
  CheckLingvaLocalProjectOptions,
  CheckLingvaLocalProjectOutput,
  CheckLingvaCliUpdateOptions,
  CheckLingvaCliUpdateOutput,
  ExportLingvaProjectOptions,
  ExportLingvaProjectOutput,
  ExtractLingvaKeysOptions,
  ExtractLingvaKeysOutput,
  GenerateProjectHelpersOptions,
  GenerateProjectHelpersOutput,
  GenerateProjectBundleOptions,
  GenerateProjectBundleOutput,
  GenerateProjectManifestOptions,
  GenerateProjectManifestOutput,
  GenerateProjectTypesOptions,
  GenerateProjectTypesOutput,
  GenerateProjectWorkflowOptions,
  GenerateProjectWorkflowOutput,
  GenerateLingvaStudioOptions,
  GenerateLingvaStudioOutput,
  InitializeLingvaProjectOptions,
  InitializeLingvaProjectOutput,
  InvalidateLingvaProjectOptions,
  InvalidateLingvaProjectOutput,
  ImportLingvaResourcesOptions,
  ImportLingvaResourcesOutput,
  LingvaCliConfig,
  LingvaCliAuthEnvironment,
  LingvaCliAuthConfig,
  LingvaCliAuthApiKeyOptions,
  LingvaCliAuthApiKeyOutput,
  LingvaCliAuthLoginOptions,
  LingvaCliAuthLoginOutput,
  LingvaCliAuthLogoutOutput,
  LingvaCliAuthStatusOutput,
  LingvaCliCredentials,
  LingvaCliExtractionPolicy,
  LingvaCliValidationPolicy,
  ListHostedLingvaDraftsOptions,
  ListHostedLingvaDraftsOutput,
  LoadedLingvaProjectModule,
  LingvaStudioNode,
  PublishLingvaProjectOptions,
  PublishLingvaProjectOutput,
  PushLingvaProjectOptions,
  PushLingvaProjectOutput,
  PullLingvaBundlesOptions,
  PullLingvaBundlesOutput,
  ScaffoldLingvaMetadataOptions,
  ScaffoldLingvaMetadataOutput,
  SyncLingvaLocalFilesOptions,
  SyncLingvaLocalFilesOutput,
  ValidateProjectOptions,
  ValidateProjectOutput,
  ValidateProjectsOutput,
  LingvaInitFile,
} from './contracts';

export type * from './contracts';

const LINGVA_CLI_PACKAGE_NAME = '@lingva/cli';
const LINGVA_CLI_LATEST_REGISTRY_URL = 'https://registry.npmjs.org/@lingva%2fcli/latest';
const LINGVA_CLI_UPDATE_COMMAND = 'pnpm add --save-dev @lingva/cli@latest';

const DEFAULT_CONFIG_FILE_NAMES = [
  'lingva.config.yaml',
  'lingva.config.yml',
  'lingva.ts',
  'lingva.mjs',
  'lingva.js',
  'lingva.config.json',
  'lingva.config.ts',
  'lingva.config.js',
  'lingva.config.mjs',
  '.lingvarc.json',
  '.lingvarc.ts',
  '.lingvarc.js',
  '.lingvarc.mjs',
] as const;
const DEFAULT_EXTRACTION_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'] as const;
const DEFAULT_INIT_LOCALES = ['en', 'ru'] as const;
const DEFAULT_REACT_PROVIDER_FILE = 'src/lingva/provider.tsx';
const DEFAULT_FRAMEWORK_BOOTSTRAP_FILES: Partial<Record<LingvaFramework, string>> = {
  [LINGVA_FRAMEWORKS.angular]: 'src/lingva/providers.ts',
  [LINGVA_FRAMEWORKS.next]: DEFAULT_REACT_PROVIDER_FILE,
  [LINGVA_FRAMEWORKS.react]: DEFAULT_REACT_PROVIDER_FILE,
  [LINGVA_FRAMEWORKS.svelte]: 'src/lib/lingva.ts',
  [LINGVA_FRAMEWORKS.vue]: 'src/lingva/index.ts',
};
const DEFAULT_GENERATED_PROJECT_FILE = '.lingva/generated/project.ts';
const DEFAULT_METADATA_FILE = '.lingva/metadata.json';
const DEFAULT_LOCAL_WORKFLOW_README_FILE = '.lingva/README.md';
const DEFAULT_REMOTE_STATE_FILE = '.lingva/remote-state.json';
const DEFAULT_LINGVA_GITIGNORE_FILE = '.lingva/.gitignore';
const REMOTE_STATE_SCHEMA_VERSION = 1;
const DEFAULT_GITHUB_LOCAL_WORKFLOW_FILE = '.github/workflows/lingva-local.yml';
const DEFAULT_AUTH_SCOPES = ['openid', 'profile', 'email', 'offline_access'] as const;
export const DEFAULT_LINGVA_PLATFORM_URL = 'https://lingva.dev';
const DEFAULT_AUTH_CALLBACK_PATH = '/callback';

export interface LingvaCliPlatformProject {
  defaultLocale: string;
  environments: Array<{ environmentId: string; publishApiUrl?: string }>;
  locales: string[];
  name: string;
  projectId: string;
}

function normalizePlatformUrl(value?: string): string {
  return (value?.trim() || process.env['LINGVA_PLATFORM_URL']?.trim() || DEFAULT_LINGVA_PLATFORM_URL).replace(
    /\/+$/u,
    ''
  );
}

export async function discoverLingvaCliAuthConfig(platformUrl?: string): Promise<{
  clientId: string;
  issuerUrl: string;
  platformUrl: string;
}> {
  const baseUrl = normalizePlatformUrl(platformUrl);
  const response = await fetch(`${baseUrl}/api/cli/config`, {
    headers: { [LINGVA_HTTP_HEADERS.accept]: LINGVA_MEDIA_TYPES.json },
  });
  const body = (await response.json().catch(() => null)) as {
    clientId?: string;
    issuerUrl?: string;
    platformUrl?: string;
    error?: string;
  } | null;

  if (!response.ok || !body?.clientId || !body.issuerUrl) {
    throw new Error(body?.error || `Unable to discover Lingva CLI auth from ${baseUrl}.`);
  }

  return { clientId: body.clientId, issuerUrl: body.issuerUrl, platformUrl: body.platformUrl || baseUrl };
}

export async function listLingvaCliPlatformProjects(input: {
  accessToken: string;
  platformUrl?: string;
}): Promise<LingvaCliPlatformProject[]> {
  const baseUrl = normalizePlatformUrl(input.platformUrl);
  const response = await fetch(`${baseUrl}/api/cli/projects`, {
    headers: {
      [LINGVA_HTTP_HEADERS.accept]: LINGVA_MEDIA_TYPES.json,
      [LINGVA_HTTP_HEADERS.authorization]: `Bearer ${input.accessToken}`,
    },
  });
  const body = (await response.json().catch(() => null)) as {
    projects?: LingvaCliPlatformProject[];
    error?: string;
  } | null;

  if (!response.ok || !Array.isArray(body?.projects)) {
    throw new Error(body?.error || `Unable to list Lingva projects from ${baseUrl}.`);
  }

  return body.projects;
}

function parseStableVersion(value: string): readonly number[] {
  return value
    .replace(/^v/u, '')
    .split('-')[0]!
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = parseStableVersion(latest);
  const currentParts = parseStableVersion(current);
  const length = Math.max(latestParts.length, currentParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (latestParts[index] ?? 0) - (currentParts[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }

  return false;
}

/** Checks npm metadata but never mutates the consumer project. */
export async function checkLingvaCliUpdate(options: CheckLingvaCliUpdateOptions): Promise<CheckLingvaCliUpdateOutput> {
  const response = await fetch(LINGVA_CLI_LATEST_REGISTRY_URL, {
    headers: { [LINGVA_HTTP_HEADERS.accept]: LINGVA_MEDIA_TYPES.json },
  });
  const body = (await response.json().catch(() => null)) as { version?: string } | null;

  if (!response.ok || !body?.version) {
    throw new Error(`Unable to check the latest ${LINGVA_CLI_PACKAGE_NAME} version.`);
  }

  const updateAvailable = isNewerVersion(body.version, options.currentVersion);
  const output = {
    currentVersion: options.currentVersion,
    latestVersion: body.version,
    updateAvailable,
    ...(updateAvailable ? { installCommand: LINGVA_CLI_UPDATE_COMMAND } : {}),
  };
  const textReport = updateAvailable
    ? [
        `Lingva CLI update available: ${options.currentVersion} -> ${body.version}`,
        `Run: ${LINGVA_CLI_UPDATE_COMMAND}`,
      ].join('\n')
    : `Lingva CLI is current (${options.currentVersion}).`;
  const report = options.format === LINGVA_SERIALIZATION_FORMATS.json ? JSON.stringify(output, null, 2) : textReport;

  return { ...output, report };
}
const DEFAULT_AUTH_PORT = 53682;
const TEMPLATE_PLACEHOLDER_PATTERN = /\{\{([A-Z0-9_]+)\}\}/gu;

function readCliTemplate(name: string): string {
  return readFileSync(new URL(`./templates/${name}`, import.meta.url), 'utf8');
}

function renderCliTemplate(name: string, values: Record<string, string>): string {
  return readCliTemplate(name).replace(TEMPLATE_PLACEHOLDER_PATTERN, (match, key: string) => {
    if (!(key in values)) {
      throw new Error(`Missing Lingva CLI template value "${key}" for "${name}".`);
    }

    return values[key] ?? match;
  });
}

function toCodeStringLiteral(value: string): string {
  return `'${value
    .replace(/\\/gu, '\\\\')
    .replace(/'/gu, "\\'")
    .replace(/\r/gu, '\\r')
    .replace(/\n/gu, '\\n')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029')}'`;
}

function toProcessEnvAccess(name: string): string {
  return /^[A-Z_a-z]\w*$/u.test(name) ? `.${name}` : `[${toCodeStringLiteral(name)}]`;
}

function toSafeIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'lingva-project';
}

function toTitleCaseLocale(locale: string): string {
  return locale.trim().toLowerCase();
}

function toModuleImportPath(
  fromFilePath: string,
  targetFilePath: string,
  options: { stripExtension?: boolean } = {}
): string {
  const fromDir = path.posix.dirname(fromFilePath);
  const relativePath = path.posix.relative(fromDir, targetFilePath);
  const importPath = options.stripExtension === false ? relativePath : relativePath.replace(/\.[^.]+$/, '');

  return importPath.startsWith('./') || importPath.startsWith('../') ? importPath : `./${importPath}`;
}

function normalizeInitLocales(locales: string[] | undefined, defaultLocale: string, fallbackLocale: string): string[] {
  const values = locales && locales.length > 0 ? locales : [...DEFAULT_INIT_LOCALES];
  const normalized = Array.from(
    new Set(
      [defaultLocale, fallbackLocale, ...values]
        .map((locale) => toTitleCaseLocale(locale))
        .filter((locale) => locale.length > 0)
    )
  );

  return normalized;
}

function base64Url(source: Uint8Array): string {
  return Buffer.from(source).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function getDefaultLingvaCredentialsFile(): string {
  return path.join(os.homedir(), '.lingva', 'credentials.json');
}

function createLingvaCliApiKeyPreview(apiKey: string): string {
  const trimmed = apiKey.trim();

  return trimmed.length > 12 ? `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}` : 'stored-key';
}

function getTokenExpiration(obtainedAt: Date, expiresIn: unknown): string | undefined {
  return typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0
    ? new Date(obtainedAt.getTime() + expiresIn * 1000).toISOString()
    : undefined;
}

function isTokenExpired(credentials: LingvaCliCredentials, now = Date.now()): boolean {
  return credentials.expiresAt ? Date.parse(credentials.expiresAt) <= now + 60_000 : false;
}

function parseScopeList(value: string | undefined): string[] {
  const scopes = value
    ?.split(/[,\s]+/u)
    .map((scope) => scope.trim())
    .filter(Boolean);

  return scopes && scopes.length > 0 ? scopes : [...DEFAULT_AUTH_SCOPES];
}

function createCodeVerifier(): string {
  return base64Url(randomBytes(48));
}

function createCodeChallenge(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest());
}

function buildIssuerEndpoint(issuerUrl: string, endpoint: 'authorize' | 'device_authorization' | 'token'): string {
  return `${issuerUrl.replace(/\/+$/u, '')}/oauth2/${endpoint}`;
}

function openBrowser(url: string): void {
  const platformCommands: Partial<Record<NodeJS.Platform, string>> = {
    darwin: 'open',
    win32: 'cmd',
  };
  const command = platformCommands[process.platform] ?? 'xdg-open';
  const args: string[] = process.platform === 'win32' ? ['/c', 'start', '""', url] : [url];

  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.once('error', () => undefined);
  child.unref();
}

export function resolveLingvaCliAuthConfig(
  options: Pick<
    LingvaCliAuthLoginOptions,
    'authorizeUrl' | 'clientId' | 'deviceUrl' | 'environment' | 'issuerUrl' | 'scopes' | 'tokenUrl'
  >
): LingvaCliAuthConfig {
  const environment = options.environment ?? process.env;
  const issuerUrl = normalizeOptionalString(options.issuerUrl ?? environment.LINGVA_AUTH_ISSUER_URL);
  const authorizeUrl =
    normalizeOptionalString(options.authorizeUrl ?? environment.LINGVA_AUTH_AUTHORIZE_URL) ??
    (issuerUrl ? buildIssuerEndpoint(issuerUrl, 'authorize') : undefined);
  const deviceUrl =
    normalizeOptionalString(options.deviceUrl ?? environment.LINGVA_AUTH_DEVICE_URL) ??
    (issuerUrl ? buildIssuerEndpoint(issuerUrl, 'device_authorization') : undefined);
  const tokenUrl =
    normalizeOptionalString(options.tokenUrl ?? environment.LINGVA_AUTH_TOKEN_URL) ??
    (issuerUrl ? buildIssuerEndpoint(issuerUrl, 'token') : undefined);
  const clientId = normalizeOptionalString(options.clientId ?? environment.LINGVA_AUTH_CLIENT_ID);
  const scopes =
    options.scopes && options.scopes.length > 0 ? options.scopes : parseScopeList(environment.LINGVA_AUTH_SCOPES);

  if (!authorizeUrl || !deviceUrl || !tokenUrl || !clientId) {
    throw new Error('Lingva auth login requires --issuer-url or explicit auth endpoints and --client-id.');
  }

  return {
    authorizeUrl,
    clientId,
    deviceUrl,
    scopes,
    tokenUrl,
  };
}

export async function loadLingvaCliCredentials(
  credentialsFile = getDefaultLingvaCredentialsFile()
): Promise<LingvaCliCredentials | null> {
  const raw = await fs.readFile(credentialsFile, 'utf8').catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  });

  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw) as Partial<LingvaCliCredentials>;
  const hasAccessToken = typeof parsed.accessToken === 'string' && parsed.accessToken.trim().length > 0;
  const hasApiKey = typeof parsed.apiKey === 'string' && parsed.apiKey.trim().length > 0;

  if (!parsed.obtainedAt || (!hasAccessToken && !hasApiKey) || (hasAccessToken && !parsed.tokenType)) {
    throw new Error(`Lingva credentials file "${credentialsFile}" is invalid.`);
  }

  return parsed as LingvaCliCredentials;
}

export async function saveLingvaCliCredentials(
  credentials: LingvaCliCredentials,
  credentialsFile = getDefaultLingvaCredentialsFile()
): Promise<string> {
  await fs.mkdir(path.dirname(credentialsFile), {
    recursive: true,
    mode: 0o700,
  });
  await fs.writeFile(credentialsFile, `${JSON.stringify(credentials, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await fs.chmod(credentialsFile, 0o600).catch(() => undefined);

  return credentialsFile;
}

export async function clearLingvaCliCredentials(credentialsFile = getDefaultLingvaCredentialsFile()): Promise<void> {
  await fs.rm(credentialsFile, { force: true });
}

export function getLingvaCliCredentialsAuthToken(credentials: LingvaCliCredentials | null): string | undefined {
  if (!credentials) {
    return undefined;
  }

  if (credentials.accessToken && !isTokenExpired(credentials)) {
    return credentials.accessToken;
  }

  return credentials.apiKey;
}

export async function saveLingvaCliApiKeyCredentials(
  options: LingvaCliAuthApiKeyOptions
): Promise<LingvaCliAuthApiKeyOutput> {
  const apiKey = normalizeOptionalString(options.apiKey);

  if (!apiKey) {
    throw new Error('Lingva auth use-key requires a non-empty --api-key value.');
  }

  const credentialsFile = options.credentialsFile ?? getDefaultLingvaCredentialsFile();
  const apiKeyPreview = createLingvaCliApiKeyPreview(apiKey);
  const credentials: LingvaCliCredentials = {
    apiKey,
    apiKeyPreview,
    apiUrl: normalizeOptionalString(options.apiUrl),
    obtainedAt: new Date().toISOString(),
    projectId: normalizeOptionalString(options.projectId),
  };

  await saveLingvaCliCredentials(credentials, credentialsFile);

  return {
    apiKeyPreview,
    credentialsFile,
    projectId: credentials.projectId,
    report: [
      'Lingva auth project API key stored.',
      `- credentials: ${credentialsFile}`,
      `- key: ${apiKeyPreview}`,
      ...(credentials.projectId ? [`- project: ${credentials.projectId}`] : []),
    ].join('\n'),
  };
}

export async function refreshLingvaCliCredentials(input: {
  clientId: string;
  credentials: LingvaCliCredentials;
  tokenUrl: string;
}): Promise<LingvaCliCredentials> {
  if (!input.credentials.refreshToken) {
    throw new Error('Lingva auth refresh requires a refresh token.');
  }

  const response = await fetch(input.tokenUrl, {
    method: LINGVA_HTTP_METHODS.post,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: input.clientId,
      grant_type: 'refresh_token',
      refresh_token: input.credentials.refreshToken,
    }),
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok || typeof body?.access_token !== 'string') {
    throw new Error(
      typeof body?.error_description === 'string' ? body.error_description : 'Lingva auth refresh failed.'
    );
  }

  const obtainedAt = new Date();

  return {
    ...input.credentials,
    accessToken: body.access_token,
    clientId: input.clientId,
    expiresAt: getTokenExpiration(obtainedAt, body.expires_in),
    idToken: typeof body.id_token === 'string' ? body.id_token : input.credentials.idToken,
    obtainedAt: obtainedAt.toISOString(),
    refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : input.credentials.refreshToken,
    scope: typeof body.scope === 'string' ? body.scope : input.credentials.scope,
    tokenType: typeof body.token_type === 'string' ? body.token_type : input.credentials.tokenType,
    tokenUrl: input.tokenUrl,
  };
}

export async function resolveLingvaCliStoredAuthToken(
  options: {
    credentialsFile?: string;
    environment?: LingvaCliAuthEnvironment & Record<string, string | undefined>;
  } = {}
): Promise<string | undefined> {
  const credentialsFile = options.credentialsFile ?? getDefaultLingvaCredentialsFile();
  const credentials = await loadLingvaCliCredentials(credentialsFile).catch(() => null);
  const currentToken = getLingvaCliCredentialsAuthToken(credentials);

  if (currentToken) {
    return currentToken;
  }

  if (!credentials?.refreshToken) {
    return undefined;
  }

  const environment = options.environment ?? process.env;
  const tokenUrl =
    normalizeOptionalString(credentials.tokenUrl ?? environment.LINGVA_AUTH_TOKEN_URL) ??
    (normalizeOptionalString(environment.LINGVA_AUTH_ISSUER_URL)
      ? buildIssuerEndpoint(normalizeOptionalString(environment.LINGVA_AUTH_ISSUER_URL)!, 'token')
      : undefined);
  const clientId = normalizeOptionalString(credentials.clientId ?? environment.LINGVA_AUTH_CLIENT_ID);

  if (!tokenUrl || !clientId) {
    return undefined;
  }

  const refreshed = await refreshLingvaCliCredentials({
    clientId,
    credentials,
    tokenUrl,
  });
  await saveLingvaCliCredentials(refreshed, credentialsFile);

  return refreshed.accessToken;
}

export async function exchangeLingvaAuthCodeForCredentials(input: {
  apiUrl?: string;
  clientId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  tokenUrl: string;
}): Promise<LingvaCliCredentials> {
  const response = await fetch(input.tokenUrl, {
    method: LINGVA_HTTP_METHODS.post,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: input.clientId,
      code: input.code,
      code_verifier: input.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
    }),
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok || typeof body?.access_token !== 'string') {
    throw new Error(
      typeof body?.error_description === 'string' ? body.error_description : 'Lingva auth token exchange failed.'
    );
  }

  const obtainedAt = new Date();

  return {
    accessToken: body.access_token,
    apiUrl: typeof body.lingva_api_url === 'string' ? body.lingva_api_url : input.apiUrl,
    clientId: input.clientId,
    expiresAt: getTokenExpiration(obtainedAt, body.expires_in),
    idToken: typeof body.id_token === 'string' ? body.id_token : undefined,
    obtainedAt: obtainedAt.toISOString(),
    refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : undefined,
    scope: typeof body.scope === 'string' ? body.scope : undefined,
    tokenType: typeof body.token_type === 'string' ? body.token_type : 'Bearer',
    tokenUrl: input.tokenUrl,
  };
}

export async function requestLingvaDeviceAuthorization(input: {
  clientId: string;
  deviceUrl: string;
  scopes: string[];
}): Promise<{
  deviceCode: string;
  expiresIn: number;
  interval: number;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
}> {
  const response = await fetch(input.deviceUrl, {
    method: LINGVA_HTTP_METHODS.post,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: input.clientId,
      scope: input.scopes.join(' '),
    }),
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (
    !response.ok ||
    typeof body?.device_code !== 'string' ||
    typeof body.user_code !== 'string' ||
    typeof body.verification_uri !== 'string'
  ) {
    throw new Error(
      typeof body?.error_description === 'string' ? body.error_description : 'Lingva device authorization failed.'
    );
  }

  return {
    deviceCode: body.device_code,
    expiresIn: typeof body.expires_in === 'number' ? body.expires_in : 600,
    interval: typeof body.interval === 'number' && body.interval > 0 ? body.interval : 5,
    userCode: body.user_code,
    verificationUri: body.verification_uri,
    verificationUriComplete:
      typeof body.verification_uri_complete === 'string' ? body.verification_uri_complete : undefined,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function pollLingvaDeviceCredentials(input: {
  clientId: string;
  deviceCode: string;
  expiresIn: number;
  interval: number;
  tokenUrl: string;
}): Promise<LingvaCliCredentials> {
  const startedAt = Date.now();
  let intervalMs = input.interval * 1000;

  while (Date.now() - startedAt < input.expiresIn * 1000) {
    await wait(intervalMs);

    const response = await fetch(input.tokenUrl, {
      method: LINGVA_HTTP_METHODS.post,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: input.clientId,
        device_code: input.deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (response.ok && typeof body?.access_token === 'string') {
      const obtainedAt = new Date();

      return {
        accessToken: body.access_token,
        clientId: input.clientId,
        expiresAt: getTokenExpiration(obtainedAt, body.expires_in),
        idToken: typeof body.id_token === 'string' ? body.id_token : undefined,
        obtainedAt: obtainedAt.toISOString(),
        refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : undefined,
        scope: typeof body.scope === 'string' ? body.scope : undefined,
        tokenType: typeof body.token_type === 'string' ? body.token_type : 'Bearer',
        tokenUrl: input.tokenUrl,
      };
    }

    if (body?.error === 'authorization_pending') {
      continue;
    }

    if (body?.error === 'slow_down') {
      intervalMs += 5_000;
      continue;
    }

    throw new Error(
      typeof body?.error_description === 'string'
        ? body.error_description
        : 'Lingva device authorization token polling failed.'
    );
  }

  throw new Error('Lingva device authorization expired.');
}

async function waitForLingvaAuthCallback(input: {
  authorizeUrl: string;
  browser: boolean;
  clientId: string;
  codeChallenge: string;
  port?: number;
  scopes: string[];
  state: string;
}): Promise<{ code: string; redirectUri: string }> {
  return await new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');

      if (requestUrl.pathname !== DEFAULT_AUTH_CALLBACK_PATH) {
        response.writeHead(404).end('Not found');
        return;
      }

      const error = requestUrl.searchParams.get('error');
      const code = requestUrl.searchParams.get('code');
      const state = requestUrl.searchParams.get('state');

      if (error) {
        response.writeHead(400, { 'content-type': 'text/plain' }).end(`Lingva auth failed: ${error}`);
        server.close();
        reject(new Error(`Lingva auth failed: ${error}`));
        return;
      }

      if (!code || state !== input.state) {
        response.writeHead(400, { 'content-type': 'text/plain' }).end('Lingva auth callback is invalid.');
        server.close();
        reject(new Error('Lingva auth callback is invalid.'));
        return;
      }

      response
        .writeHead(200, { 'content-type': 'text/html' })
        .end(
          '<!doctype html><title>Lingva CLI</title><main style="font-family: system-ui; padding: 2rem;"><h1>Lingva CLI is authenticated</h1><p>You can close this tab and return to your terminal.</p></main>'
        );
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : input.port;

      server.close();
      resolve({
        code,
        redirectUri: `http://127.0.0.1:${port}${DEFAULT_AUTH_CALLBACK_PATH}`,
      });
    });

    server.once('error', reject);
    server.listen(input.port ?? DEFAULT_AUTH_PORT, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : input.port;
      const redirectUri = `http://127.0.0.1:${port}${DEFAULT_AUTH_CALLBACK_PATH}`;
      const url = new URL(input.authorizeUrl);
      url.searchParams.set('client_id', input.clientId);
      url.searchParams.set('code_challenge', input.codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', input.scopes.join(' '));
      url.searchParams.set('state', input.state);

      console.log(`Open this URL to authenticate Lingva CLI:\n${url.toString()}\n`);

      if (input.browser) {
        openBrowser(url.toString());
      }
    });
  });
}

export async function loginLingvaCli(options: LingvaCliAuthLoginOptions = {}): Promise<LingvaCliAuthLoginOutput> {
  const environment = options.environment ?? process.env;
  const hasExplicitAuthEndpoint = Boolean(
    options.issuerUrl ||
    (options.authorizeUrl && options.tokenUrl) ||
    options.environment?.LINGVA_AUTH_ISSUER_URL ||
    (options.environment?.LINGVA_AUTH_AUTHORIZE_URL && options.environment?.LINGVA_AUTH_TOKEN_URL) ||
    environment['LINGVA_AUTH_ISSUER_URL'] ||
    (environment['LINGVA_AUTH_AUTHORIZE_URL'] && environment['LINGVA_AUTH_TOKEN_URL'])
  );
  const discovered = hasExplicitAuthEndpoint ? undefined : await discoverLingvaCliAuthConfig(options.platformUrl);
  const authConfig = resolveLingvaCliAuthConfig({
    ...options,
    clientId: options.clientId ?? discovered?.clientId,
    issuerUrl: options.issuerUrl ?? discovered?.issuerUrl,
  });
  const credentialsFile = options.credentialsFile ?? getDefaultLingvaCredentialsFile();
  let credentials: LingvaCliCredentials;

  if (options.device) {
    const device = await requestLingvaDeviceAuthorization({
      clientId: authConfig.clientId,
      deviceUrl: authConfig.deviceUrl,
      scopes: authConfig.scopes,
    });

    console.log(
      [
        'Lingva device login:',
        `- open: ${device.verificationUriComplete ?? device.verificationUri}`,
        `- code: ${device.userCode}`,
        '',
        'Waiting for browser approval...',
      ].join('\n')
    );

    credentials = await pollLingvaDeviceCredentials({
      clientId: authConfig.clientId,
      deviceCode: device.deviceCode,
      expiresIn: device.expiresIn,
      interval: device.interval,
      tokenUrl: authConfig.tokenUrl,
    });
  } else {
    const codeVerifier = createCodeVerifier();
    const codeChallenge = createCodeChallenge(codeVerifier);
    const state = base64Url(randomBytes(24));
    const callback = await waitForLingvaAuthCallback({
      authorizeUrl: authConfig.authorizeUrl,
      browser: options.browser ?? true,
      clientId: authConfig.clientId,
      codeChallenge,
      port: options.port,
      scopes: authConfig.scopes,
      state,
    });
    credentials = await exchangeLingvaAuthCodeForCredentials({
      clientId: authConfig.clientId,
      code: callback.code,
      codeVerifier,
      redirectUri: callback.redirectUri,
      tokenUrl: authConfig.tokenUrl,
    });
  }

  credentials = {
    ...credentials,
    platformUrl: discovered?.platformUrl ?? normalizePlatformUrl(options.platformUrl),
  };
  await saveLingvaCliCredentials(credentials, credentialsFile);

  return {
    credentialsFile,
    expiresAt: credentials.expiresAt,
    profile: credentials.profile,
    report: [
      'Lingva auth login completed.',
      `- credentials: ${credentialsFile}`,
      ...(credentials.expiresAt ? [`- expires: ${credentials.expiresAt}`] : []),
    ].join('\n'),
  };
}

export async function getLingvaCliAuthStatus(
  credentialsFile = getDefaultLingvaCredentialsFile()
): Promise<LingvaCliAuthStatusOutput> {
  const credentials = await loadLingvaCliCredentials(credentialsFile);
  const authenticated = Boolean(getLingvaCliCredentialsAuthToken(credentials));
  const authMethods: Array<readonly [boolean, 'api-key' | 'oauth']> = [
    [Boolean(credentials?.apiKey), 'api-key' as const],
    [Boolean(credentials?.accessToken), 'oauth' as const],
  ];
  const authMethod = authMethods.find(([matches]) => matches)?.[1];

  return {
    authenticated,
    authMethod,
    apiKeyPreview: credentials?.apiKeyPreview,
    credentialsFile,
    expiresAt: credentials?.expiresAt,
    profile: credentials?.profile,
    projectId: credentials?.projectId,
    report: authenticated
      ? [
          'Lingva auth status: authenticated',
          ...(authMethod ? [`- method: ${authMethod}`] : []),
          `- credentials: ${credentialsFile}`,
          ...(credentials?.apiKeyPreview ? [`- key: ${credentials.apiKeyPreview}`] : []),
          ...(credentials?.projectId ? [`- project: ${credentials.projectId}`] : []),
          ...(credentials?.expiresAt ? [`- expires: ${credentials.expiresAt}`] : []),
        ].join('\n')
      : [
          'Lingva auth status: not authenticated',
          `- credentials: ${credentialsFile}`,
          '- run: lingva auth login',
          '- or: lingva auth use-key --api-key <project-api-key>',
        ].join('\n'),
  };
}

export async function logoutLingvaCli(
  credentialsFile = getDefaultLingvaCredentialsFile()
): Promise<LingvaCliAuthLogoutOutput> {
  await clearLingvaCliCredentials(credentialsFile);

  return {
    credentialsFile,
    report: ['Lingva auth logout completed.', `- removed: ${credentialsFile}`].join('\n'),
  };
}

function createLocalLocaleDictionary(_locale: string, isDefaultLocale: boolean): LingvaDictionary {
  return {
    common: {
      appName: 'Lingva app',
      welcome: isDefaultLocale ? 'Welcome to Lingva' : '',
    },
    auth: {
      signIn: {
        title: isDefaultLocale ? 'Sign in' : '',
        subtitle: isDefaultLocale ? 'Continue with Lingva' : '',
      },
    },
  };
}

function createLocalLocaleFileContent(locale: string, isDefaultLocale: boolean): string {
  const dictionary = createLocalLocaleDictionary(locale, isDefaultLocale);

  return `${JSON.stringify(dictionary, null, 2)}\n`;
}

function createLocalConfigContent(options: {
  locales: string[];
  defaultLocale: string;
  fallbackLocale: string;
  projectId: string;
  translationFiles: string;
  generatedProjectFile: string;
  configFile: string;
  metadataFile: string;
}): string {
  return renderCliTemplate('local-config.ts.tpl', {
    PROJECT_ID: toCodeStringLiteral(options.projectId),
    LOCALES: JSON.stringify(options.locales),
    DEFAULT_LOCALE: toCodeStringLiteral(options.defaultLocale),
    FALLBACK_LOCALE: toCodeStringLiteral(options.fallbackLocale),
    TRANSLATION_FILES: toCodeStringLiteral(options.translationFiles),
    GENERATED_PROJECT_FILE: toCodeStringLiteral(options.generatedProjectFile),
    METADATA_FILE: toCodeStringLiteral(options.metadataFile),
  });
}

function createRemoteConfigContent(options: {
  bundleUrl?: string;
  defaultLocale: string;
  environment: string;
  fallbackLocale: string;
  locales: string[];
  projectId: string;
  apiUrl: string;
  apiKeyEnv: string;
}): string {
  return renderCliTemplate('remote-config.ts.tpl', {
    PROJECT_ID: toCodeStringLiteral(options.projectId),
    ENVIRONMENT: toCodeStringLiteral(options.environment),
    LOCALES: `[${options.locales.map(toCodeStringLiteral).join(', ')}]`,
    DEFAULT_LOCALE: toCodeStringLiteral(options.defaultLocale),
    FALLBACK_LOCALE: toCodeStringLiteral(options.fallbackLocale),
    API_URL: toCodeStringLiteral(options.apiUrl),
    API_KEY_ENV_ACCESS: toProcessEnvAccess(options.apiKeyEnv),
    BUNDLE_URL: toCodeStringLiteral(
      options.bundleUrl ?? `${options.apiUrl.replace(/\/+$/, '')}${DEFAULT_REMOTE_BUNDLE_PATH_TEMPLATE}`
    ),
  });
}

function createPortableConfigContent(options: {
  apiKeyEnv: string;
  apiUrl?: string;
  defaultLocale: string;
  environment: string;
  fallbackLocale: string;
  generatedProjectFile?: string;
  locales: string[];
  metadataFile?: string;
  projectId: string;
  translationFiles: string;
  format: 'json' | 'yaml';
}): string {
  const config = {
    projectId: options.projectId,
    environment: options.environment,
    locales: options.locales,
    defaultLocale: options.defaultLocale,
    fallbackLocale: options.fallbackLocale,
    translationFiles: options.translationFiles,
    ...(options.generatedProjectFile ? { generatedProjectFile: options.generatedProjectFile } : {}),
    ...(options.metadataFile ? { metadataFile: options.metadataFile } : {}),
    ...(options.apiUrl ? { apiUrl: options.apiUrl } : {}),
    apiKeyEnv: options.apiKeyEnv,
  };

  return options.format === 'json' ? `${JSON.stringify(config, null, 2)}\n` : stringifyYaml(config);
}

function createReactProviderContent(options: {
  configFile: string;
  mode: LingvaRuntimeMode;
  providerFile: string;
  generatedProjectFile: string;
}): string {
  const projectImportPath = toCodeStringLiteral(toModuleImportPath(options.providerFile, options.generatedProjectFile));

  return renderCliTemplate('react-provider.tsx.tpl', {
    CONFIG_IMPORT: toCodeStringLiteral(toModuleImportPath(options.providerFile, options.configFile)),
    PROJECT_IMPORT_LINE:
      options.mode === LINGVA_RUNTIME_MODES.local ? `import lingvaProject from ${projectImportPath};` : '',
    CONFIGURE_INPUT:
      options.mode === LINGVA_RUNTIME_MODES.local
        ? `{\n  ...lingvaConfig,\n  project: lingvaProject,\n}`
        : 'lingvaConfig',
  });
}

function createNextProviderContent(options: {
  configFile: string;
  mode: LingvaRuntimeMode;
  providerFile: string;
  generatedProjectFile: string;
}): string {
  const projectImportPath = toCodeStringLiteral(toModuleImportPath(options.providerFile, options.generatedProjectFile));

  return renderCliTemplate('next-provider.tsx.tpl', {
    CONFIG_IMPORT: toCodeStringLiteral(toModuleImportPath(options.providerFile, options.configFile)),
    PROJECT_IMPORT_LINE:
      options.mode === LINGVA_RUNTIME_MODES.local ? `import lingvaProject from ${projectImportPath};` : '',
    PROJECT_OPTION_LINE: options.mode === LINGVA_RUNTIME_MODES.local ? '  project: lingvaProject,\n' : '',
  });
}

interface FrameworkBootstrapContentOptions {
  configFile: string;
  mode: LingvaRuntimeMode;
  bootstrapFile: string;
  generatedProjectFile: string;
}

function createFrameworkAdapterTemplateValues(options: FrameworkBootstrapContentOptions) {
  const projectImportPath = toCodeStringLiteral(
    toModuleImportPath(options.bootstrapFile, options.generatedProjectFile)
  );
  const localMode = options.mode === LINGVA_RUNTIME_MODES.local;

  return {
    CONFIG_IMPORT: toCodeStringLiteral(toModuleImportPath(options.bootstrapFile, options.configFile)),
    PROJECT_IMPORT_LINE: localMode ? `import lingvaProject, { type resources } from ${projectImportPath};` : '',
    RESOURCE_TYPE: localMode ? '<typeof resources>' : '',
    ADAPTER_INPUT: localMode
      ? `{
  ...lingvaConfig,
  project: lingvaProject,
}`
      : 'lingvaConfig',
  };
}

function createAngularProviderContent(options: FrameworkBootstrapContentOptions): string {
  const values = createFrameworkAdapterTemplateValues(options);
  return renderCliTemplate('angular-provider.ts.tpl', {
    ...values,
    PROJECT_IMPORT_LINE:
      options.mode === LINGVA_RUNTIME_MODES.local
        ? `import lingvaProject from ${toCodeStringLiteral(
            toModuleImportPath(options.bootstrapFile, options.generatedProjectFile)
          )};`
        : '',
  });
}

function createVuePluginContent(options: FrameworkBootstrapContentOptions): string {
  return renderCliTemplate('vue-plugin.ts.tpl', createFrameworkAdapterTemplateValues(options));
}

function createSvelteRuntimeContent(options: FrameworkBootstrapContentOptions): string {
  return renderCliTemplate('svelte-runtime.ts.tpl', createFrameworkAdapterTemplateValues(options));
}

const FRAMEWORK_BOOTSTRAP_CONTENT_CREATORS: Partial<
  Record<LingvaFramework, (options: FrameworkBootstrapContentOptions) => string>
> = {
  [LINGVA_FRAMEWORKS.angular]: createAngularProviderContent,
  [LINGVA_FRAMEWORKS.next]: (options) =>
    createNextProviderContent({
      configFile: options.configFile,
      generatedProjectFile: options.generatedProjectFile,
      mode: options.mode,
      providerFile: options.bootstrapFile,
    }),
  [LINGVA_FRAMEWORKS.react]: (options) =>
    createReactProviderContent({
      configFile: options.configFile,
      generatedProjectFile: options.generatedProjectFile,
      mode: options.mode,
      providerFile: options.bootstrapFile,
    }),
  [LINGVA_FRAMEWORKS.svelte]: createSvelteRuntimeContent,
  [LINGVA_FRAMEWORKS.vue]: createVuePluginContent,
};

function createGeneratedProjectModuleContent(options: {
  configFile: string;
  generatedProjectFile: string;
  keyMetadata?: LingvaRuntimeConfig<LingvaResources>['keyMetadata'];
  resources: LingvaResources;
  translationFiles: string;
  locales: string[];
  defaultLocale: string;
  fallbackLocale: string;
  environment?: string;
  projectId?: string;
}): string {
  const importLines = options.locales
    .map((locale) => {
      const localeFile = resolveConfigRelativePath(options.configFile, options.translationFiles, locale).replace(
        /\\/g,
        '/'
      );
      const fromDir = path.posix.dirname(options.generatedProjectFile);
      const relativePath = path.posix.relative(fromDir, localeFile);
      const importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;

      return `import ${locale}Locale from '${importPath}';`;
    })
    .join('\n');
  const localeEntries = options.locales.map((locale) => `  ${locale}: ${locale}Locale,`).join('\n');
  const resourceType = renderGeneratedResourceType(options.resources);

  return renderCliTemplate('generated-project.ts.tpl', {
    IMPORT_LINES: importLines,
    LOCALE_ENTRIES: localeEntries,
    RESOURCE_TYPE: resourceType,
    PROJECT_ID: options.projectId ? toCodeStringLiteral(options.projectId) : 'undefined',
    DEFAULT_LOCALE: toCodeStringLiteral(options.defaultLocale),
    FALLBACK_LOCALE: toCodeStringLiteral(options.fallbackLocale),
    ENVIRONMENT_LINE: options.environment ? `  environment: ${toCodeStringLiteral(options.environment)},` : '',
    KEY_METADATA_LINE: options.keyMetadata ? `  keyMetadata: ${JSON.stringify(options.keyMetadata, null, 2)},` : '',
  });
}

/**
 * JSON module imports intentionally widen string values. Emitting a type-only
 * literal preserves message placeholders without duplicating translations in
 * the generated JavaScript bundle.
 */
function renderGeneratedResourceType(value: unknown, depth = 0): string {
  if (typeof value === 'string') {
    return toCodeStringLiteral(value);
  }

  if (Array.isArray(value)) {
    const indentation = '  '.repeat(depth + 1);
    const closingIndentation = '  '.repeat(depth);
    const entries = value.map((entry) => `${indentation}${renderGeneratedResourceType(entry, depth + 1)}`);
    return `readonly [\n${entries.join(',\n')}\n${closingIndentation}]`;
  }

  if (isPlainObject(value)) {
    const indentation = '  '.repeat(depth + 1);
    const closingIndentation = '  '.repeat(depth);
    const entries = Object.entries(value).map(
      ([key, entry]) =>
        `${indentation}readonly ${toCodeStringLiteral(key)}: ${renderGeneratedResourceType(entry, depth + 1)};`
    );
    return `{\n${entries.join('\n')}\n${closingIndentation}}`;
  }

  throw new Error('Lingva generated resource types only support dictionaries, message strings, and variant arrays.');
}

function createMetadataContent(dictionary: LingvaDictionary): string {
  const metadata = Object.fromEntries(
    Object.keys(flattenLingvaCliDictionary(dictionary))
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, createDefaultLingvaKeyMetadata(key)])
  );

  return `${JSON.stringify(metadata, null, 2)}\n`;
}

function createLocalWorkflowReadmeContent(options: { configFile: string; includeMetadata: boolean }): string {
  const configFile = options.configFile.replace(/\\/g, '/');
  const localCommands = [
    ...(options.includeMetadata ? [`lingva metadata ${configFile} --output .lingva/metadata.json`] : []),
    `lingva sync ${configFile}`,
    ...(options.includeMetadata ? [`lingva studio ${configFile} --output .lingva/studio.html`] : []),
  ];
  const ciCommands = [
    ...(options.includeMetadata ? [`lingva metadata ${configFile} --check`] : []),
    `lingva check ${configFile}`,
  ];

  return [
    '# Lingva Local Workflow',
    '',
    'This directory is managed by Lingva local mode.',
    '',
    'Recommended local commands:',
    '',
    '```bash',
    ...localCommands,
    '```',
    '',
    'Recommended CI guards:',
    '',
    '```bash',
    ...ciCommands,
    '```',
    '',
    'Notes:',
    '',
    '- edit the default locale first',
    '- run sync before committing locale files',
    '- variant drift checks catch missing variants, extra variants, and metadata mismatches',
    '',
  ].join('\n');
}

function createGithubLocalWorkflowContent(options: { configFile: string; includeMetadata: boolean }): string {
  const configFile = options.configFile.replace(/\\/g, '/');

  return [
    'name: Lingva Local Checks',
    '',
    'on:',
    '  pull_request:',
    '  push:',
    '    branches:',
    '      - main',
    '  workflow_dispatch:',
    '',
    'permissions:',
    '  contents: read',
    '',
    'jobs:',
    '  lingva-local:',
    '    name: Validate local translations',
    '    runs-on: ubuntu-latest',
    '',
    '    steps:',
    '      - name: Checkout repository',
    '        uses: actions/checkout@v6',
    '',
    '      - name: Setup pnpm',
    '        uses: pnpm/action-setup@v6',
    '        with:',
    '          version: 10',
    '',
    '      - name: Setup Node.js',
    '        uses: actions/setup-node@v6',
    '        with:',
    '          node-version: 24',
    '          cache: pnpm',
    '',
    '      - name: Install dependencies',
    '        run: pnpm install --frozen-lockfile',
    '',
    ...(options.includeMetadata
      ? ['      - name: Check Lingva metadata drift', `        run: pnpm lingva metadata ${configFile} --check`, '']
      : []),
    '      - name: Check local translation sync',
    `        run: pnpm lingva check ${configFile}`,
    '',
  ].join('\n');
}

export function createLingvaInitScaffold(options: InitializeLingvaProjectOptions = {}): {
  mode: LingvaRuntimeMode;
  framework?: LingvaFramework;
  sdk?: LingvaSetupTarget;
  ci?: 'github';
  configFile: string;
  files: LingvaInitFile[];
} {
  const mode = options.mode ?? 'local';
  const sdk = options.sdk ?? options.framework;
  const framework =
    sdk && Object.values(LINGVA_FRAMEWORKS).includes(sdk as LingvaFramework) ? (sdk as LingvaFramework) : undefined;

  if (options.framework && !framework) {
    throw new Error(
      `Unsupported framework "${options.framework}". Choose ${Object.values(LINGVA_FRAMEWORKS).join(', ')}.`
    );
  }
  const ci = options.ci;
  const defaultLocale = toTitleCaseLocale(options.defaultLocale ?? 'en');
  const fallbackLocale = toTitleCaseLocale(options.fallbackLocale ?? defaultLocale);
  const projectId = toSafeIdentifier(options.projectId ?? 'lingva-app');
  const environment = toSafeIdentifier(options.environment ?? 'dev');
  const configFile = options.configFile ?? (sdk === 'python' ? 'lingva.config.yaml' : 'lingva.config.ts');
  const translationFiles = (
    options.translationFiles ??
    options.localesDir ??
    '.lingva/translations/{locale}.json'
  ).replace(/\\/g, '/');
  const bootstrapFile = (
    options.providerFile ??
    (framework ? DEFAULT_FRAMEWORK_BOOTSTRAP_FILES[framework] : undefined) ??
    DEFAULT_REACT_PROVIDER_FILE
  ).replace(/\\/g, '/');
  const generatedProjectFile = DEFAULT_GENERATED_PROJECT_FILE;
  const metadataFile = DEFAULT_METADATA_FILE;
  const usesGeneratedTypeScript = Boolean(framework) || !sdk;
  const usesPortableConfig = /\.(?:json|ya?ml)$/u.test(configFile);
  const portableConfigFormat = configFile.endsWith('.json') ? 'json' : 'yaml';
  const files: LingvaInitFile[] = [];

  if (ci === 'github' && mode !== LINGVA_RUNTIME_MODES.local) {
    throw new Error('Lingva GitHub CI scaffold currently supports local mode only.');
  }

  if (mode === LINGVA_RUNTIME_MODES.local) {
    const locales = normalizeInitLocales(options.locales, defaultLocale, fallbackLocale);

    files.push({
      path: configFile,
      content: usesPortableConfig
        ? createPortableConfigContent({
            apiKeyEnv: options.apiKeyEnv ?? 'LINGVA_API_KEY',
            apiUrl: options.apiUrl,
            locales,
            defaultLocale,
            fallbackLocale,
            projectId,
            environment,
            translationFiles,
            generatedProjectFile: usesGeneratedTypeScript ? generatedProjectFile : undefined,
            metadataFile: usesGeneratedTypeScript ? metadataFile : undefined,
            format: portableConfigFormat,
          })
        : createLocalConfigContent({
            locales,
            defaultLocale,
            fallbackLocale,
            projectId,
            translationFiles,
            generatedProjectFile,
            configFile,
            metadataFile,
          }),
    });

    for (const locale of locales) {
      files.push({
        path: applyTranslationFileTemplate(translationFiles, locale),
        content: createLocalLocaleFileContent(locale, locale === defaultLocale),
      });
    }

    if (usesGeneratedTypeScript) {
      files.push({
        path: generatedProjectFile,
        content: createGeneratedProjectModuleContent({
          configFile,
          generatedProjectFile,
          keyMetadata: Object.fromEntries(
            Object.keys(flattenLingvaCliDictionary(createLocalLocaleDictionary(defaultLocale, true)))
              .sort((left, right) => left.localeCompare(right))
              .map((key) => [key, createDefaultLingvaKeyMetadata(key)])
          ),
          resources: Object.fromEntries(
            locales.map((locale) => [locale, createLocalLocaleDictionary(locale, locale === defaultLocale)])
          ),
          translationFiles,
          locales,
          defaultLocale,
          fallbackLocale,
          projectId,
        }),
      });

      files.push({
        path: metadataFile,
        content: createMetadataContent(createLocalLocaleDictionary(defaultLocale, true)),
      });
    }

    files.push({
      path: DEFAULT_LOCAL_WORKFLOW_README_FILE,
      content: createLocalWorkflowReadmeContent({
        configFile,
        includeMetadata: usesGeneratedTypeScript,
      }),
    });

    if (ci === 'github') {
      files.push({
        path: DEFAULT_GITHUB_LOCAL_WORKFLOW_FILE,
        content: createGithubLocalWorkflowContent({
          configFile,
          includeMetadata: usesGeneratedTypeScript,
        }),
      });
    }
  } else {
    const apiUrl = options.apiUrl?.trim();
    if (!apiUrl) {
      throw new Error(
        'Remote setup requires --api-url. Copy the publish API URL from the environment in your Lingva project setup page.'
      );
    }
    const locales = normalizeInitLocales(options.locales, defaultLocale, fallbackLocale);

    files.push({
      path: configFile,
      content: usesPortableConfig
        ? createPortableConfigContent({
            apiKeyEnv: options.apiKeyEnv ?? 'LINGVA_API_KEY',
            apiUrl,
            defaultLocale,
            environment,
            fallbackLocale,
            locales,
            projectId,
            translationFiles,
            format: portableConfigFormat,
          })
        : createRemoteConfigContent({
            bundleUrl: options.bundleUrl,
            defaultLocale,
            environment,
            fallbackLocale,
            locales,
            projectId,
            apiUrl,
            apiKeyEnv: options.apiKeyEnv ?? 'LINGVA_API_KEY',
          }),
    });
  }

  files.push({ path: DEFAULT_LINGVA_GITIGNORE_FILE, content: 'remote-state.json\n' });

  const createBootstrapContent = framework ? FRAMEWORK_BOOTSTRAP_CONTENT_CREATORS[framework] : undefined;
  if (createBootstrapContent) {
    files.push({
      path: bootstrapFile,
      content: createBootstrapContent({
        bootstrapFile,
        configFile,
        generatedProjectFile,
        mode,
      }),
    });
  }

  return {
    mode,
    framework,
    sdk,
    ci,
    configFile,
    files,
  };
}

function createLingvaInitNextSteps(options: {
  apiKeyEnv?: string;
  configFile: string;
  files: LingvaInitFile[];
  framework?: LingvaFramework;
  mode: LingvaRuntimeMode;
  sdk?: LingvaSetupTarget;
}): string[] {
  const bootstrapMarker = options.framework
    ? {
        [LINGVA_FRAMEWORKS.angular]: 'provideAppLingva',
        [LINGVA_FRAMEWORKS.next]: 'AppLingvaProvider',
        [LINGVA_FRAMEWORKS.react]: 'AppLingvaProvider',
        [LINGVA_FRAMEWORKS.svelte]: 'appLingva',
        [LINGVA_FRAMEWORKS.vanilla]: undefined,
        [LINGVA_FRAMEWORKS.vue]: 'appLingva',
      }[options.framework]
    : undefined;
  const bootstrapFile = bootstrapMarker
    ? options.files.find((file) => file.content.includes(bootstrapMarker))
    : undefined;

  const localSteps =
    options.sdk === 'python'
      ? [
          `Run "lingva sync ${options.configFile}" after editing the default locale.`,
          `Run "lingva check ${options.configFile}" before commits or CI.`,
          'Use "lingva auth login" before hosted pull or push workflows.',
        ]
      : [
          `Run "pnpm lingva metadata ${options.configFile} --output .lingva/metadata.json" after adding new default-locale keys.`,
          `Run "pnpm lingva sync ${options.configFile}" after editing the default locale.`,
          `Run "pnpm lingva metadata ${options.configFile} --check" and "pnpm lingva check ${options.configFile}" before commits or CI.`,
          'Use "lingva auth login" before hosted push workflows.',
          `When hosted delivery is connected, run "pnpm lingva push ${options.configFile} --invalidate".`,
        ];
  const steps =
    options.mode === LINGVA_RUNTIME_MODES.local
      ? localSteps
      : [
          `Store the read-only delivery key in "${options.apiKeyEnv ?? 'LINGVA_API_KEY'}" for runtime bundle requests.`,
          'Copy the complete "lingva auth login" command from the Lingva project setup page before hosted writes.',
          `Run "pnpm lingva check ${options.configFile}" before publishing translation changes.`,
          `Use "pnpm lingva push ${options.configFile} --invalidate" to publish hosted state, then verify the generated bundle URL.`,
          `Use "pnpm lingva pull ${options.configFile}" to refresh repository translations from hosted state.`,
        ];

  const frameworkStep = options.framework
    ? {
        [LINGVA_FRAMEWORKS.angular]: bootstrapFile
          ? `Add provideAppLingva() from "${bootstrapFile.path}" to your Angular bootstrap providers.`
          : undefined,
        [LINGVA_FRAMEWORKS.next]: bootstrapFile
          ? `Mount AppLingvaProvider from "${bootstrapFile.path}" in your Next.js app/layout.tsx.`
          : undefined,
        [LINGVA_FRAMEWORKS.react]: bootstrapFile
          ? `Wrap your app with AppLingvaProvider from "${bootstrapFile.path}".`
          : undefined,
        [LINGVA_FRAMEWORKS.svelte]: bootstrapFile
          ? `Import appLingva from "${bootstrapFile.path}" and use its stores in your Svelte components.`
          : undefined,
        [LINGVA_FRAMEWORKS.vanilla]: 'Create a runtime with createLingvaJsRuntime() at your application boundary.',
        [LINGVA_FRAMEWORKS.vue]: bootstrapFile
          ? `Install appLingva from "${bootstrapFile.path}" with app.use(appLingva).`
          : undefined,
      }[options.framework]
    : undefined;

  if (frameworkStep) {
    steps.unshift(frameworkStep);
  }

  return steps;
}

/**
 * Scaffolds a Lingva config and optional local locale modules for new projects.
 */
export async function initializeLingvaProject(
  options: InitializeLingvaProjectOptions = {}
): Promise<InitializeLingvaProjectOutput> {
  const cwd = options.cwd ?? process.cwd();
  const scaffold = createLingvaInitScaffold(options);

  if (!options.dryRun) {
    for (const file of scaffold.files) {
      const absolutePath = path.resolve(cwd, file.path);

      if (!options.force) {
        try {
          await fs.stat(absolutePath);
          throw new Error(`Refusing to overwrite existing file "${absolutePath}". Use --force to replace it.`);
        } catch (error) {
          if (!(error instanceof Error) || !error.message.startsWith('Refusing to overwrite')) {
            // Missing file is expected and should not block scaffold generation.
          } else {
            throw error;
          }
        }
      }

      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, file.content, 'utf8');
    }
  }

  const nextSteps = createLingvaInitNextSteps({
    apiKeyEnv: options.apiKeyEnv,
    configFile: scaffold.configFile,
    files: scaffold.files,
    framework: scaffold.framework,
    mode: scaffold.mode,
    sdk: scaffold.sdk,
  });
  const report =
    options.format === 'json'
      ? JSON.stringify(
          {
            mode: scaffold.mode,
            framework: scaffold.framework,
            sdk: scaffold.sdk,
            ci: scaffold.ci,
            configFile: scaffold.configFile,
            written: !options.dryRun,
            files: scaffold.files,
            nextSteps,
          },
          null,
          2
        )
      : [
          `Lingva init: ${scaffold.mode} mode${scaffold.framework ? ` (${scaffold.framework})` : ''}${scaffold.ci ? ` + ${scaffold.ci} CI` : ''}`,
          `${options.dryRun ? 'Planned files:' : 'Created files:'}`,
          ...scaffold.files.map((file) => `- ${path.resolve(cwd, file.path)}`),
          '',
          'Next steps:',
          ...nextSteps.map((step) => `- ${step}`),
        ].join('\n');

  return {
    mode: scaffold.mode,
    framework: scaffold.framework,
    sdk: scaffold.sdk,
    ci: scaffold.ci,
    configFile: path.resolve(cwd, scaffold.configFile),
    files: scaffold.files.map((file) => ({
      ...file,
      path: path.resolve(cwd, file.path),
    })),
    nextSteps,
    written: !options.dryRun,
    report,
  };
}

function normalizeCodes(codes: string[] | undefined): string[] {
  if (!codes) {
    return [];
  }

  return Array.from(new Set(codes.map((code) => code.trim()).filter((code) => code.length > 0)));
}

function filterIssues(
  issues: LingvaProjectValidationIssue[],
  options: Pick<ValidateProjectOptions, 'onlyCodes' | 'ignoreCodes' | 'maxIssues'>
): LingvaProjectValidationIssue[] {
  const onlyCodes = normalizeCodes(options.onlyCodes);
  const ignoreCodes = normalizeCodes(options.ignoreCodes);
  const onlySet = new Set(onlyCodes);
  const ignoreSet = new Set(ignoreCodes);

  let filteredIssues = issues.filter((issue) => {
    if (onlySet.size > 0 && !onlySet.has(issue.code)) {
      return false;
    }

    if (ignoreSet.has(issue.code)) {
      return false;
    }

    return true;
  });

  if (typeof options.maxIssues === 'number' && Number.isFinite(options.maxIssues) && options.maxIssues >= 0) {
    filteredIssues = filteredIssues.slice(0, options.maxIssues);
  }

  return filteredIssues;
}

function createValidationResult(issues: LingvaProjectValidationIssue[]): {
  valid: boolean;
  issues: LingvaProjectValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
} {
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const infoCount = issues.filter((issue) => issue.severity === 'info').length;

  return {
    valid: errorCount === 0,
    issues,
    errorCount,
    warningCount,
    infoCount,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLingvaMessageVariant(value: unknown): value is LingvaMessageVariant {
  return (
    isPlainObject(value) && typeof value.id === 'string' && value.id.trim().length > 0 && typeof value.text === 'string'
  );
}

function isLingvaMessageVariants(value: unknown): value is LingvaMessageVariants {
  return Array.isArray(value) && value.every(isLingvaMessageVariant);
}

function isLingvaLeafMessage(value: unknown): value is LingvaMessage {
  return typeof value === 'string' || isLingvaMessageVariants(value);
}

function isValidationPolicy(value: unknown): value is LingvaCliValidationPolicy {
  return isPlainObject(value);
}

function isExtractionPolicy(value: unknown): value is LingvaCliExtractionPolicy {
  return isPlainObject(value);
}

function isPublishConfig(value: unknown): value is NonNullable<LingvaCliConfig['publish']> {
  return isPlainObject(value);
}

function isInvalidateConfig(value: unknown): value is NonNullable<LingvaCliConfig['invalidate']> {
  return isPlainObject(value);
}

function isAuthoringConfig(value: unknown): value is NonNullable<LingvaCliConfig['authoring']> {
  return isPlainObject(value);
}

function isLingvaProject(value: unknown): value is AnyLingvaProject {
  return typeof value === 'object' && value !== null && 'createClient' in value && 'getConfig' in value;
}

function isLingvaRuntimeConfig(value: unknown): value is { project?: AnyLingvaProject; cli?: LingvaCliConfig } {
  return isPlainObject(value);
}

function isFileBackedLingvaRuntimeConfig(
  value: LingvaRuntimeConfig<LingvaResources> | undefined
): value is LingvaRuntimeConfig<LingvaResources> & {
  locales: readonly string[];
  translationFiles: string;
} {
  if (!value) {
    return false;
  }

  return (
    Array.isArray(value.locales) &&
    value.locales.every((locale) => typeof locale === 'string' && locale.length > 0) &&
    typeof value.translationFiles === 'string' &&
    value.translationFiles.length > 0
  );
}

function extractLingvaRuntimeConfig(
  module: LoadedLingvaProjectModule
): LingvaRuntimeConfig<LingvaResources> | undefined {
  if (isLingvaRuntimeConfig(module.config)) {
    return module.config as LingvaRuntimeConfig<LingvaResources>;
  }

  if (isLingvaRuntimeConfig(module.default)) {
    return module.default as LingvaRuntimeConfig<LingvaResources>;
  }

  return undefined;
}

function extractLingvaProjectFromModule(module: LoadedLingvaProjectModule): AnyLingvaProject | undefined {
  const directProject = module.default ?? module.project;

  if (isLingvaProject(directProject)) {
    return directProject;
  }

  if (isLingvaRuntimeConfig(module.config) && isLingvaProject(module.config.project)) {
    return module.config.project;
  }

  if (isLingvaRuntimeConfig(module.default) && isLingvaProject(module.default.project)) {
    return module.default.project;
  }

  return undefined;
}

function sortDictionaryKeys(value: LingvaDictionary): LingvaDictionary {
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => {
        if (isLingvaMessageVariants(nestedValue) || typeof nestedValue === 'string') {
          return [key, nestedValue];
        }

        if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
          return [key, sortDictionaryKeys(nestedValue)];
        }

        return [key, nestedValue];
      })
  ) as LingvaDictionary;
}

function createBlankDictionaryFromSource(source: LingvaDictionary): LingvaDictionary {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => {
      if (typeof value === 'string') {
        return [key, ''];
      }

      if (isLingvaMessageVariants(value)) {
        return [
          key,
          value.map((variant) => ({
            ...variant,
            text: '',
          })),
        ];
      }

      return [key, createBlankDictionaryFromSource(value)];
    })
  ) as LingvaDictionary;
}

function mergeMissingKeysFromSource(source: LingvaDictionary, target: LingvaDictionary): LingvaDictionary {
  const output: LingvaDictionary = structuredClone(target);

  for (const [key, value] of Object.entries(source)) {
    if (!(key in output)) {
      const missingValueResolvers = [
        [typeof value === 'string', () => ''],
        [isLingvaMessageVariants(value), () => createBlankDictionaryFromSource({ [key]: value })[key] as LingvaMessage],
      ] as const;
      output[key] = (
        missingValueResolvers.find(([matches]) => matches)?.[1] ??
        (() => createBlankDictionaryFromSource(value as LingvaDictionary))
      )();
      continue;
    }

    if (isLingvaMessageVariants(value)) {
      if (isLingvaMessageVariants(output[key])) {
        const currentVariants = new Map(output[key].map((variant) => [variant.id, variant]));

        output[key] = value.map((variant) => {
          const currentVariant = currentVariants.get(variant.id);

          return currentVariant && isLingvaMessageVariant(currentVariant)
            ? {
                ...variant,
                ...currentVariant,
              }
            : {
                ...variant,
                text: '',
              };
        });
      } else {
        output[key] = value.map((variant) => ({
          ...variant,
          text: '',
        }));
      }

      continue;
    }

    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === 'object' &&
      !Array.isArray(output[key])
    ) {
      output[key] = mergeMissingKeysFromSource(value, output[key] as LingvaDictionary);
    }
  }

  return sortDictionaryKeys(output);
}

function mergeDictionaryPatch(source: LingvaDictionary, patch: LingvaDictionary): LingvaDictionary {
  const output: LingvaDictionary = structuredClone(source);

  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === 'string' || isLingvaMessageVariants(value)) {
      output[key] = value;
      continue;
    }

    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === 'object' &&
      !Array.isArray(output[key])
    ) {
      output[key] = mergeDictionaryPatch(output[key] as LingvaDictionary, value);
      continue;
    }

    output[key] = value;
  }

  return sortDictionaryKeys(output);
}

function flattenLingvaCliDictionary(dictionary: LingvaDictionary, prefix = ''): Record<string, LingvaMessage> {
  const output: Record<string, LingvaMessage> = {};

  for (const [key, value] of Object.entries(dictionary)) {
    const pathKey = prefix ? `${prefix}.${key}` : key;

    if (isLingvaLeafMessage(value)) {
      output[pathKey] = value;
    } else if (isPlainObject(value)) {
      Object.assign(output, flattenLingvaCliDictionary(value, pathKey));
    }
  }

  return output;
}

interface LingvaRemoteLocaleState {
  base: LingvaDictionary;
  revision: string;
}

interface LingvaRemoteState {
  schemaVersion: number;
  projectId: string;
  environment: string;
  locales: Record<string, LingvaRemoteLocaleState>;
}

function createLingvaRemoteState(projectId: string, environment: string): LingvaRemoteState {
  return { schemaVersion: REMOTE_STATE_SCHEMA_VERSION, projectId, environment, locales: {} };
}

async function readLingvaRemoteState(root: string, projectId: string, environment: string): Promise<LingvaRemoteState> {
  try {
    const parsed = JSON.parse(
      await fs.readFile(path.resolve(root, DEFAULT_REMOTE_STATE_FILE), 'utf8')
    ) as LingvaRemoteState;
    if (
      parsed.schemaVersion === REMOTE_STATE_SCHEMA_VERSION &&
      parsed.projectId === projectId &&
      parsed.environment === environment &&
      isPlainObject(parsed.locales)
    ) {
      return parsed;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }
  return createLingvaRemoteState(projectId, environment);
}

async function writeLingvaRemoteState(root: string, state: LingvaRemoteState): Promise<void> {
  const stateFile = path.resolve(root, DEFAULT_REMOTE_STATE_FILE);
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await fs.writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function setFlatLingvaMessage(dictionary: LingvaDictionary, key: string, value: LingvaMessage): void {
  const segments = key.split('.');
  const leaf = segments.pop();
  let cursor = dictionary;
  for (const segment of segments) {
    const current = cursor[segment];
    const nested = isPlainObject(current) ? current : {};
    cursor[segment] = nested;
    cursor = nested;
  }
  if (leaf) cursor[leaf] = structuredClone(value);
}

function selectThreeWayLingvaValue<T>(input: { base: T; local: T; remote: T; missing: T }): {
  conflict: boolean;
  value: T;
} {
  const localMatchesRemote = JSON.stringify(input.local) === JSON.stringify(input.remote);
  if (localMatchesRemote) return { conflict: false, value: input.local };
  const localMatchesBase = JSON.stringify(input.local) === JSON.stringify(input.base);
  if (localMatchesBase) return { conflict: false, value: input.remote };
  const remoteMatchesBase = JSON.stringify(input.remote) === JSON.stringify(input.base);
  if (remoteMatchesBase) return { conflict: false, value: input.local };
  return { conflict: true, value: input.missing };
}

function mergeLingvaRemoteDictionary(
  locale: string,
  base: LingvaDictionary,
  local: LingvaDictionary,
  remote: LingvaDictionary
): LingvaDictionary {
  const baseEntries = flattenLingvaCliDictionary(base);
  const localEntries = flattenLingvaCliDictionary(local);
  const remoteEntries = flattenLingvaCliDictionary(remote);
  const keys = [
    ...new Set([...Object.keys(baseEntries), ...Object.keys(localEntries), ...Object.keys(remoteEntries)]),
  ].sort();
  const merged: LingvaDictionary = {};
  const conflicts: string[] = [];
  const missing = Symbol('missing');

  for (const key of keys) {
    const baseValue = baseEntries[key] ?? missing;
    const localValue = localEntries[key] ?? missing;
    const remoteValue = remoteEntries[key] ?? missing;
    const selected = selectThreeWayLingvaValue({ base: baseValue, local: localValue, remote: remoteValue, missing });

    if (selected.conflict) {
      conflicts.push(key);
      continue;
    }
    if (selected.value !== missing) setFlatLingvaMessage(merged, key, selected.value as LingvaMessage);
  }

  if (conflicts.length > 0) {
    throw new Error(
      `Lingva pull found conflicts in locale "${locale}": ${conflicts.join(', ')}. Resolve local or hosted values, then pull again.`
    );
  }
  return sortDictionaryKeys(merged);
}

function createLingvaPublishMutationId(artifacts: LingvaPublishArtifacts): string {
  const semanticManifest = { ...artifacts.manifest, generatedAt: undefined };
  const semanticBundles = Object.fromEntries(
    Object.entries(artifacts.bundles).map(([locale, bundle]) => {
      const semanticBundle = { ...bundle, generatedAt: undefined };
      return [locale, semanticBundle];
    })
  );
  return `sha256:${createHash('sha256')
    .update(JSON.stringify({ manifest: semanticManifest, bundles: semanticBundles }))
    .digest('hex')}`;
}

function inferLingvaKeyNamespace(key: string): string | undefined {
  return key.includes('.') ? key.split('.')[0] : undefined;
}

function createDefaultLingvaKeyMetadata(key: string, status: LingvaKeyMetadata['status'] = 'draft'): LingvaKeyMetadata {
  return {
    description: `TODO: Describe "${key}".`,
    namespace: inferLingvaKeyNamespace(key),
    status,
  };
}

const VARIANT_SYNC_CONTRACT_FIELDS = [
  'tone',
  'mood',
  'intonation',
  'label',
  'context',
] as const satisfies ReadonlyArray<keyof LingvaMessageVariant>;

interface LingvaLocalDictionaryDrift {
  missingKeys: number;
  missingVariants: number;
  extraVariants: number;
  variantMetadataMismatches: number;
}

function createEmptyDictionaryDrift(): LingvaLocalDictionaryDrift {
  return {
    missingKeys: 0,
    missingVariants: 0,
    extraVariants: 0,
    variantMetadataMismatches: 0,
  };
}

function addDictionaryDrift(target: LingvaLocalDictionaryDrift, source: LingvaLocalDictionaryDrift): void {
  target.missingKeys += source.missingKeys;
  target.missingVariants += source.missingVariants;
  target.extraVariants += source.extraVariants;
  target.variantMetadataMismatches += source.variantMetadataMismatches;
}

function getVariantSyncFieldValue(
  variant: LingvaMessageVariant,
  field: (typeof VARIANT_SYNC_CONTRACT_FIELDS)[number]
): string | undefined {
  const value = variant[field];

  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function countVariantMetadataMismatches(
  sourceVariant: LingvaMessageVariant,
  targetVariant: LingvaMessageVariant
): number {
  return VARIANT_SYNC_CONTRACT_FIELDS.filter(
    (field) => getVariantSyncFieldValue(sourceVariant, field) !== getVariantSyncFieldValue(targetVariant, field)
  ).length;
}

function analyzeDictionaryDrift(source: LingvaDictionary, target: LingvaDictionary): LingvaLocalDictionaryDrift {
  const drift = createEmptyDictionaryDrift();

  for (const [key, value] of Object.entries(source)) {
    if (!(key in target)) {
      drift.missingKeys += 1;
      continue;
    }

    if (isLingvaMessageVariants(value)) {
      if (!isLingvaMessageVariants(target[key])) {
        drift.missingVariants += value.length;
        continue;
      }

      const sourceVariants = new Map(value.map((variant) => [variant.id, variant]));
      const targetVariants = new Map(target[key].map((variant) => [variant.id, variant]));

      for (const variant of value) {
        const targetVariant = targetVariants.get(variant.id);

        if (!targetVariant) {
          drift.missingVariants += 1;
          continue;
        }

        drift.variantMetadataMismatches += countVariantMetadataMismatches(variant, targetVariant);
      }

      for (const variant of targetVariants.values()) {
        if (!sourceVariants.has(variant.id)) {
          drift.extraVariants += 1;
        }
      }

      continue;
    }

    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      addDictionaryDrift(drift, analyzeDictionaryDrift(value, target[key] as LingvaDictionary));
    }
  }

  return drift;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeJsonForHtmlScript(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
}

function getDictionaryValueBySegments(dictionary: LingvaDictionary, segments: string[]): LingvaMessage | undefined {
  let current: unknown = dictionary;

  for (const segment of segments) {
    if (!current || typeof current !== 'object' || Array.isArray(current) || !(segment in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return isLingvaLeafMessage(current) ? current : undefined;
}

function buildLingvaStudioTree(
  source: LingvaDictionary,
  dictionaries: Record<string, LingvaDictionary>,
  locales: string[],
  parentPath = ''
): LingvaStudioNode[] {
  return Object.entries(source)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => {
      const currentPath = parentPath ? `${parentPath}.${key}` : key;
      const segments = currentPath.split('.');

      if (isLingvaLeafMessage(value)) {
        return {
          key,
          path: currentPath,
          value,
          locales: Object.fromEntries(
            locales.map((locale) => {
              const localeValue = getDictionaryValueBySegments(dictionaries[locale] ?? {}, segments);

              return [
                locale,
                {
                  value: localeValue,
                  missing:
                    localeValue === undefined ||
                    (typeof localeValue === 'string'
                      ? localeValue.trim() === ''
                      : localeValue.every((variant) => variant.text.trim() === '')),
                },
              ];
            })
          ),
          children: [],
        } satisfies LingvaStudioNode;
      }

      return {
        key,
        path: currentPath,
        locales: Object.fromEntries(
          locales.map((locale) => [
            locale,
            {
              value: undefined,
              missing: false,
            },
          ])
        ),
        children: buildLingvaStudioTree(value, dictionaries, locales, currentPath),
      } satisfies LingvaStudioNode;
    });
}

function flattenLingvaStudioMessages(tree: LingvaStudioNode[]): LingvaStudioNode[] {
  return tree.flatMap((node) => (node.children.length > 0 ? flattenLingvaStudioMessages(node.children) : [node]));
}

function formatLingvaStudioLeafPreview(value: LingvaMessage | undefined): string {
  if (value === undefined) {
    return '—';
  }

  if (typeof value === 'string') {
    return escapeHtml(value.trim() || '—');
  }

  return value
    .map((variant) => {
      const chips = [variant.tone, variant.mood, variant.intonation].filter(Boolean).join(' · ');
      const meta = chips ? ` <span class="lingva-variant-meta">${escapeHtml(chips)}</span>` : '';

      return `<div class="lingva-variant-preview"><strong>${escapeHtml(variant.id)}</strong>${meta}<div>${escapeHtml(variant.text.trim() || '—')}</div></div>`;
    })
    .join('');
}

function renderDefaultLocaleEditor(path: string, value: LingvaMessage | undefined): string {
  if (typeof value === 'string' || value === undefined) {
    return `<label class="lingva-editor-label" for="lingva-input-${escapeHtml(path)}">Default message</label><textarea id="lingva-input-${escapeHtml(path)}" class="lingva-editor" data-lingva-path="${escapeHtml(path)}">${escapeHtml(value ?? '')}</textarea>`;
  }

  return value
    .map((variant) => {
      const chips = [variant.tone, variant.mood, variant.intonation].filter(Boolean).join(' · ');
      const hint = chips.length > 0 ? ` <span class="lingva-editor-hint">${escapeHtml(chips)}</span>` : '';

      return `<div class="lingva-variant-editor"><label class="lingva-editor-label" for="lingva-input-${escapeHtml(path)}-${escapeHtml(variant.id)}"><strong>${escapeHtml(variant.id)}</strong>${hint}</label><textarea id="lingva-input-${escapeHtml(path)}-${escapeHtml(variant.id)}" class="lingva-editor" data-lingva-path="${escapeHtml(path)}" data-lingva-variant-id="${escapeHtml(variant.id)}">${escapeHtml(variant.text)}</textarea></div>`;
    })
    .join('');
}

function renderLingvaStudioTree(tree: LingvaStudioNode[], locales: string[], defaultLocale: string): string {
  return tree
    .map((node) => {
      if (node.children.length > 0) {
        return `<li class="lingva-node lingva-node-group"><details open><summary><span class="lingva-key">${escapeHtml(node.path)}</span></summary><ul class="lingva-tree">${renderLingvaStudioTree(node.children, locales, defaultLocale)}</ul></details></li>`;
      }

      const localeBadges = locales
        .map((locale) => {
          const entry = node.locales[locale];
          if (locale === defaultLocale) {
            return `<div class="lingva-locale-card source"><div class="lingva-locale-header"><span class="lingva-locale-name">${escapeHtml(locale)}</span><span class="lingva-locale-status">Source</span></div>${renderDefaultLocaleEditor(node.path, entry?.value ?? node.value)}</div>`;
          }

          const statusClass = entry?.missing ? 'missing' : 'translated';
          const statusLabel = entry?.missing ? 'Missing' : 'Translated';
          const preview = formatLingvaStudioLeafPreview(entry?.value);

          return `<div class="lingva-locale-card ${statusClass}"><div class="lingva-locale-header"><span class="lingva-locale-name">${escapeHtml(locale)}</span><span class="lingva-locale-status">${statusLabel}</span></div><div class="lingva-locale-value">${preview}</div></div>`;
        })
        .join('');

      return `<li class="lingva-node lingva-node-leaf"><div class="lingva-message-card"><div class="lingva-message-header"><code>${escapeHtml(node.path)}</code></div><div class="lingva-message-default">${formatLingvaStudioLeafPreview(node.value)}</div><div class="lingva-locale-grid">${localeBadges}</div></div></li>`;
    })
    .join('');
}

function formatLingvaStudioHtml(output: GenerateLingvaStudioOutput): string {
  const studioData = {
    defaultLocale: output.defaultLocale,
    locales: output.locales,
    tree: output.tree,
  };
  const coverageCards = output.locales
    .map((locale) => {
      const coverage = output.summary.localeCoverage[locale];
      const action =
        locale === output.defaultLocale
          ? `<button class="lingva-action" type="button" data-lingva-download-default="${escapeHtml(locale)}">Download ${escapeHtml(locale)}.json</button>`
          : `<button class="lingva-action" type="button" data-lingva-download-locale="${escapeHtml(locale)}">Download synced ${escapeHtml(locale)}.json</button>`;

      return `<article class="lingva-summary-card"><h2>${escapeHtml(locale)}</h2><p><strong>${coverage?.translated ?? 0}</strong> translated</p><p><strong>${coverage?.missing ?? 0}</strong> missing</p>${action}</article>`;
    })
    .join('');

  return renderCliTemplate('studio-html.html.tpl', {
    HTML_LANG: escapeHtml(output.defaultLocale),
    CONFIG_FILE: escapeHtml(output.configFile),
    DEFAULT_LOCALE: escapeHtml(output.defaultLocale),
    LOCALE_COUNT: String(output.locales.length),
    TOTAL_KEYS: String(output.summary.totalKeys),
    COVERAGE_CARDS: coverageCards,
    MESSAGE_TREE: renderLingvaStudioTree(output.tree, output.locales, output.defaultLocale),
    STUDIO_DATA: escapeJsonForHtmlScript(studioData),
  });
}

function extractLingvaCliConfig(value: unknown): LingvaCliConfig | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  if (isPlainObject(value.cli)) {
    return value.cli as LingvaCliConfig;
  }

  return value as LingvaCliConfig;
}

function matchesSimpleGlob(filePath: string, pattern: string): boolean {
  const normalized = pattern.trim();

  if (normalized === '' || normalized === '*') {
    return true;
  }

  const fileName = path.basename(filePath);

  if (!normalized.includes('*')) {
    return fileName === normalized;
  }

  const [prefix, suffix] = normalized.split('*');

  return fileName.startsWith(prefix ?? '') && fileName.endsWith(suffix ?? '');
}

function shouldExcludeFile(filePath: string, patterns: string[] | undefined): boolean {
  if (!patterns || patterns.length === 0) {
    return false;
  }

  return patterns.some((pattern) => {
    const normalized = pattern.trim();

    if (normalized.length === 0) {
      return false;
    }

    return filePath.includes(normalized) || matchesSimpleGlob(filePath, normalized);
  });
}

async function collectFiles(targetPath: string): Promise<string[]> {
  const stats = await fs.stat(targetPath);

  if (stats.isFile()) {
    return [targetPath];
  }

  if (!stats.isDirectory()) {
    return [];
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absoluteEntryPath = path.join(targetPath, entry.name);

      if (entry.isDirectory()) {
        return collectFiles(absoluteEntryPath);
      }

      if (entry.isFile()) {
        return [absoluteEntryPath];
      }

      return [];
    })
  );

  return files.flat();
}

function normalizeExtensions(extensions: string[] | undefined): string[] {
  const values = extensions ?? [...DEFAULT_EXTRACTION_EXTENSIONS];

  return Array.from(
    new Set(
      values
        .map((extension) => extension.trim())
        .filter((extension) => extension.length > 0)
        .map((extension) => (extension.startsWith('.') ? extension : `.${extension}`))
    )
  );
}

function normalizePathPatterns(patterns: string[] | undefined): string[] {
  if (!patterns) {
    return [];
  }

  return Array.from(new Set(patterns.map((pattern) => pattern.trim()).filter((pattern) => pattern.length > 0)));
}

function sortRecord(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortRecord);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, sortRecord(nestedValue)])
  );
}

function mergeLingvaResources(baseResources: LingvaResources, importedResources: LingvaResources): LingvaResources {
  const locales = new Set([...Object.keys(baseResources), ...Object.keys(importedResources)]);

  return Object.fromEntries(
    Array.from(locales)
      .sort((left, right) => left.localeCompare(right))
      .map((locale) => [
        locale,
        {
          ...(baseResources[locale] ?? {}),
          ...(importedResources[locale] ?? {}),
        },
      ])
  ) as LingvaResources;
}

function isLingvaResourcesShape(value: unknown): value is LingvaResources {
  if (!isPlainObject(value)) {
    return false;
  }

  return Object.values(value).every((dictionary) => isPlainObject(dictionary));
}

async function writeOutputFile(outputFile: string | undefined, report: string): Promise<void> {
  if (!outputFile) {
    return;
  }

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, report, 'utf8');
}

async function importLingvaModule(moduleFile: string): Promise<LoadedLingvaProjectModule> {
  if (/\.(?:json|ya?ml)$/u.test(moduleFile)) {
    const source = await fs.readFile(moduleFile, 'utf8');
    const parsed = moduleFile.endsWith('.json') ? (JSON.parse(source) as unknown) : (parseYaml(source) as unknown);

    if (isPlainObject(parsed) && typeof parsed.apiKeyEnv === 'string' && !parsed.apiKey) {
      const apiKey = process.env[parsed.apiKeyEnv];

      if (apiKey) {
        parsed.apiKey = apiKey;
      }
    }

    return { default: parsed } as LoadedLingvaProjectModule;
  }

  if (moduleFile.endsWith('.ts')) {
    const source = await fs.readFile(moduleFile, 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: moduleFile,
    }).outputText;
    const tempModuleFile = path.join(path.dirname(moduleFile), `.lingva-temp-${randomUUID()}.mjs`);

    // Keep the temp module next to the source file so relative imports inside
    // `lingva.ts` continue to resolve as authors expect.
    await fs.writeFile(tempModuleFile, transpiled, 'utf8');

    try {
      return (await import(pathToFileURL(tempModuleFile).href)) as LoadedLingvaProjectModule;
    } finally {
      await fs.rm(tempModuleFile, { force: true });
    }
  }

  return (await import(pathToFileURL(moduleFile).href)) as LoadedLingvaProjectModule;
}

function applyPullTemplate(
  template: string,
  locale: string,
  config: Pick<LingvaConfig, 'projectId' | 'apiUrl' | 'environment'>
): string {
  const replacements: Record<string, string> = {
    locale,
    projectId: config.projectId ?? '',
    apiUrl: config.apiUrl ?? '',
    environment: config.environment ?? '',
  };

  return template.replaceAll(/\{(\w+)\}/g, (match, token) => replacements[token] ?? match);
}

function applyTranslationFileTemplate(template: string, locale: string): string {
  return template.replaceAll('{locale}', locale);
}

async function readLingvaDictionaryFile(filePath: string): Promise<LingvaDictionary> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (!isPlainObject(parsed)) {
      return {};
    }

    return parsed as LingvaDictionary;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

async function readLingvaMetadataFile(
  filePath: string
): Promise<Record<string, NonNullable<LingvaRuntimeConfig<LingvaResources>['keyMetadata']>[string]>> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (!isPlainObject(parsed)) {
      return {};
    }

    return parsed as Record<string, NonNullable<LingvaRuntimeConfig<LingvaResources>['keyMetadata']>[string]>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

async function readLingvaConfigMetadata(
  config: LingvaRuntimeConfig<LingvaResources>,
  configFile: string
): Promise<LingvaRuntimeConfig<LingvaResources>['keyMetadata']> {
  const metadataFile = config.metadataFile ? path.resolve(path.dirname(configFile), config.metadataFile) : undefined;
  const fileMetadata = metadataFile ? await readLingvaMetadataFile(metadataFile) : {};

  return {
    ...fileMetadata,
    ...(config.keyMetadata ?? {}),
  };
}

function resolveConfigRelativePath(configFile: string, fileTemplate: string, locale: string): string {
  const relativePath = applyTranslationFileTemplate(fileTemplate, locale);

  return path.isAbsolute(relativePath) ? relativePath : path.resolve(path.dirname(configFile), relativePath);
}

function getTypeScriptScriptKind(filePath: string): ts.ScriptKind {
  const extension = path.extname(filePath);

  if (extension === '.ts') {
    return ts.ScriptKind.TS;
  }

  if (extension === '.tsx') {
    return ts.ScriptKind.TSX;
  }

  return ts.ScriptKind.Unknown;
}

function collectExtractedKeys(entries: Array<{ key: string; line: number }>): Array<{ key: string; line: number }> {
  const keys = new Map<string, Set<number>>();

  for (const entry of entries) {
    const lines = keys.get(entry.key) ?? new Set<number>();
    lines.add(entry.line);
    keys.set(entry.key, lines);
  }

  return Array.from(keys.entries())
    .flatMap(([key, lines]) =>
      Array.from(lines)
        .sort((left, right) => left - right)
        .map((line) => ({ key, line }))
    )
    .sort((left, right) => left.key.localeCompare(right.key) || left.line - right.line);
}

function isSupportedLingvaCallName(name: string): boolean {
  return name === 't' || name === 'tSync';
}

function getCallExpressionKeyArgument(node: ts.CallExpression): string | undefined {
  const [firstArgument] = node.arguments;

  if (!firstArgument) {
    return undefined;
  }

  if (ts.isStringLiteral(firstArgument) || ts.isNoSubstitutionTemplateLiteral(firstArgument)) {
    return firstArgument.text;
  }

  return undefined;
}

function extractLingvaKeysWithTypeScript(source: string, filePath: string): Array<{ key: string; line: number }> {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    getTypeScriptScriptKind(filePath)
  );
  const extracted: Array<{ key: string; line: number }> = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const key = getCallExpressionKeyArgument(node);

      if (key) {
        if (ts.isIdentifier(expression) && isSupportedLingvaCallName(expression.text)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          extracted.push({ key, line: line + 1 });
        }

        if (ts.isPropertyAccessExpression(expression) && isSupportedLingvaCallName(expression.name.text)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          extracted.push({ key, line: line + 1 });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return collectExtractedKeys(extracted);
}

function extractLingvaKeysWithRegex(source: string): Array<{ key: string; line: number }> {
  const extracted: Array<{ key: string; line: number }> = [];
  const pattern = /(?:^|[^\w])(t|tSync)\(\s*['"`]([^'"`]+)['"`]|\.t(?:Sync)?\(\s*['"`]([^'"`]+)['"`]/g;

  for (const match of source.matchAll(pattern)) {
    const key = match[2] ?? match[3];

    if (key) {
      const line = source.slice(0, match.index ?? 0).split('\n').length;
      extracted.push({ key, line });
    }
  }

  return collectExtractedKeys(extracted);
}

function extractLingvaKeysFromSource(source: string, filePath: string): Array<{ key: string; line: number }> {
  const scriptKind = getTypeScriptScriptKind(filePath);

  // Prefer AST-based extraction for TypeScript files and keep regex fallback for
  // the broader JavaScript surface we already support in the CLI.
  if (scriptKind === ts.ScriptKind.TS || scriptKind === ts.ScriptKind.TSX) {
    return extractLingvaKeysWithTypeScript(source, filePath);
  }

  return extractLingvaKeysWithRegex(source);
}

/**
 * Resolves project files from a direct file path or a directory plus glob pattern.
 */
export async function resolveLingvaProjectFiles(
  inputPath: string,
  options: Pick<ValidateProjectOptions, 'cwd' | 'glob'> = {}
): Promise<string[]> {
  const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.resolve(options.cwd ?? process.cwd(), inputPath);
  const files = await collectFiles(absolutePath);
  const glob = options.glob ?? '*.project.mjs';

  return files.filter((file) => matchesSimpleGlob(file, glob)).sort();
}

/**
 * Loads a Lingva project contract from a module file.
 */
export async function loadLingvaProject(projectFile: string, cwd = process.cwd()): Promise<AnyLingvaProject> {
  const absolutePath = path.isAbsolute(projectFile) ? projectFile : path.resolve(cwd, projectFile);
  const imported = await importLingvaModule(absolutePath);
  const project = extractLingvaProjectFromModule(imported);

  if (!isLingvaProject(project)) {
    const runtimeConfig = extractLingvaRuntimeConfig(imported);
    const materializedProject = runtimeConfig
      ? await materializeLingvaProjectFromRuntimeConfig(runtimeConfig, absolutePath)
      : undefined;

    if (!isLingvaProject(materializedProject)) {
      throw new Error(
        `File "${absolutePath}" does not export a Lingva project directly, through config.project, or through a file-backed local runtime config.`
      );
    }

    return materializedProject;
  }

  return project;
}

/**
 * Loads a `lingva.ts`-style runtime config and extracts the project/config pair.
 */
export async function loadLingvaRuntimeConfig(
  configFile: string,
  cwd = process.cwd()
): Promise<{
  config: LingvaRuntimeConfig<LingvaResources>;
  configFile: string;
}> {
  const absolutePath = path.isAbsolute(configFile) ? configFile : path.resolve(cwd, configFile);
  const imported = await importLingvaModule(absolutePath);
  const config = extractLingvaRuntimeConfig(imported);

  if (!config) {
    throw new Error(
      `File "${absolutePath}" does not export a Lingva runtime config. Use defineLingvaConfig(...) or export config directly.`
    );
  }

  return {
    config,
    configFile: absolutePath,
  };
}

/**
 * Adapter-only conversion of executable JS/TS configuration to the portable
 * engine document. This evaluates configuration, never command behavior.
 * The caller keeps the temporary JSON next to the original module so relative
 * translation, metadata, and remote-state paths retain their existing meaning.
 */
export async function materializeLingvaPortableConfig(configFile: string): Promise<Record<string, unknown>> {
  const absolute = path.resolve(configFile);
  const imported = await importLingvaModule(absolute);
  const runtime = extractLingvaRuntimeConfig(imported);
  const project = extractLingvaProjectFromModule(imported);
  const value = runtime ?? project;
  if (!value) {
    const settings = extractLingvaCliConfig(imported.default ?? imported.config);
    if (settings) {
      return { cli: settings };
    }
    throw new Error(`File "${absolute}" does not export a Lingva configuration or project.`);
  }
  const config = value as unknown as Record<string, unknown>;
  const resources = project?.resources ?? runtime?.resources;
  const document: Record<string, unknown> = {
    projectId: runtime?.projectId ?? project?.projectId,
    environment: runtime?.environment ?? project?.environment,
    locales: runtime?.locales ?? Object.keys(resources ?? {}),
    defaultLocale: runtime?.defaultLocale ?? project?.defaultLocale,
    fallbackLocale: runtime?.fallbackLocale ?? project?.fallbackLocale,
    translationFiles: runtime?.translationFiles,
    metadataFile: runtime?.metadataFile,
    keyMetadata: runtime?.keyMetadata ?? project?.getKeyMetadataMap(),
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
    apiKeyEnv: config.apiKeyEnv,
    cli: Object.fromEntries(
      Object.entries(extractLingvaCliConfig(config) ?? {}).filter(([key]) =>
        [
          'sync',
          'check',
          'validate',
          'validatePolicies',
          'extract',
          'extractPolicies',
          'publish',
          'invalidate',
          'authoring',
          'metadata',
          'studio',
        ].includes(key)
      )
    ),
  };
  // File-backed configuration stays file-backed: do not freeze an imported
  // generated project and subsequently publish stale resources after sync.
  if (!runtime?.translationFiles) {
    document.resources = resources;
  }
  if (typeof document.projectId !== 'string' || !document.projectId.trim()) {
    if (!runtime?.translationFiles && !resources && Object.keys(document.cli as Record<string, unknown>).length > 0) {
      return { cli: document.cli, apiUrl: document.apiUrl, apiKeyEnv: document.apiKeyEnv };
    }
    throw new Error(`Executable config "${absolute}" requires projectId for the native CLI.`);
  }
  return document;
}

async function materializeLingvaProjectFromRuntimeConfig(
  runtimeConfig: LingvaRuntimeConfig<LingvaResources>,
  configFile: string
): Promise<AnyLingvaProject | undefined> {
  if (!isFileBackedLingvaRuntimeConfig(runtimeConfig)) {
    return undefined;
  }

  const resources = Object.fromEntries(
    await Promise.all(
      runtimeConfig.locales.map(async (locale) => {
        const filePath = resolveConfigRelativePath(configFile, runtimeConfig.translationFiles, locale);
        const dictionary = await readLingvaDictionaryFile(filePath);

        return [locale, dictionary];
      })
    )
  ) as LingvaResources;

  const defaultLocale = runtimeConfig.defaultLocale ?? runtimeConfig.locale ?? runtimeConfig.locales[0] ?? 'en';
  const fallbackLocale = runtimeConfig.fallbackLocale ?? defaultLocale;
  const keyMetadata = await readLingvaConfigMetadata(runtimeConfig, configFile);

  return defineLingvaProject({
    projectId: runtimeConfig.projectId,
    apiKey: runtimeConfig.apiKey,
    apiUrl: runtimeConfig.apiUrl,
    environment: runtimeConfig.environment,
    keyMetadata,
    resources,
    defaultLocale,
    fallbackLocale,
  });
}

export async function syncLingvaLocalFiles(
  configFile: string,
  options: SyncLingvaLocalFilesOptions = {}
): Promise<SyncLingvaLocalFilesOutput> {
  const { config, configFile: absoluteConfigFile } = await loadLingvaRuntimeConfig(configFile, options.cwd);

  if (!isFileBackedLingvaRuntimeConfig(config)) {
    throw new Error(
      `Lingva sync requires a runtime config with locales[] and translationFiles in "${absoluteConfigFile}".`
    );
  }

  const locales = Array.from(new Set(config.locales.map((locale) => locale.trim()).filter(Boolean)));
  const defaultLocale = (config.defaultLocale ?? config.locale ?? locales[0] ?? 'en').trim();
  const fallbackLocale = (config.fallbackLocale ?? defaultLocale).trim();
  const write = options.write ?? true;
  const keyMetadata = await readLingvaConfigMetadata(config, absoluteConfigFile);

  if (!locales.includes(defaultLocale)) {
    locales.unshift(defaultLocale);
  }

  const defaultLocaleFile = resolveConfigRelativePath(absoluteConfigFile, config.translationFiles, defaultLocale);
  const defaultDictionary = sortDictionaryKeys(await readLingvaDictionaryFile(defaultLocaleFile));
  const fileReports: Array<{
    locale: string;
    filePath: string;
    missingKeys: number;
    missingVariants: number;
    extraVariants: number;
    variantMetadataMismatches: number;
    written: boolean;
  }> = [];
  const resources: LingvaResources = {};

  for (const locale of locales) {
    const filePath = resolveConfigRelativePath(absoluteConfigFile, config.translationFiles, locale);
    const currentDictionary = sortDictionaryKeys(await readLingvaDictionaryFile(filePath));
    const drift =
      locale === defaultLocale
        ? createEmptyDictionaryDrift()
        : analyzeDictionaryDrift(defaultDictionary, currentDictionary);
    const nextDictionary =
      locale === defaultLocale ? currentDictionary : mergeMissingKeysFromSource(defaultDictionary, currentDictionary);
    resources[locale] = nextDictionary;

    if (write) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, `${JSON.stringify(nextDictionary, null, 2)}\n`, 'utf8');
    }

    fileReports.push({
      locale,
      filePath,
      ...drift,
      written: write,
    });
  }

  const generatedProjectFile = path.resolve(
    path.dirname(absoluteConfigFile),
    config.generatedProjectFile ?? DEFAULT_GENERATED_PROJECT_FILE
  );

  if (write) {
    const generatedContent = createGeneratedProjectModuleContent({
      configFile: absoluteConfigFile,
      generatedProjectFile,
      keyMetadata,
      resources,
      translationFiles: config.translationFiles,
      locales,
      defaultLocale,
      fallbackLocale,
      environment: config.environment,
      projectId: config.projectId,
    });

    await fs.mkdir(path.dirname(generatedProjectFile), { recursive: true });
    await fs.writeFile(generatedProjectFile, generatedContent, 'utf8');
  }

  const hasDrift = fileReports.some(
    (file) =>
      file.missingKeys > 0 || file.missingVariants > 0 || file.extraVariants > 0 || file.variantMetadataMismatches > 0
  );
  const report =
    options.format === 'json'
      ? JSON.stringify(
          {
            configFile: absoluteConfigFile,
            defaultLocale,
            locales,
            generatedProjectFile,
            hasDrift,
            files: fileReports,
          },
          null,
          2
        )
      : [
          `Lingva sync: ${write ? 'updated' : 'planned'} local translations for ${locales.join(', ')}`,
          ...fileReports.map((file) => {
            if (file.locale === defaultLocale) {
              return `- ${file.locale}: ${file.filePath} [default]`;
            }

            const driftSummary = [
              `${file.missingKeys} missing key${file.missingKeys === 1 ? '' : 's'}`,
              `${file.missingVariants} missing variant${file.missingVariants === 1 ? '' : 's'}`,
              `${file.extraVariants} extra variant${file.extraVariants === 1 ? '' : 's'}`,
              `${file.variantMetadataMismatches} variant metadata mismatch${file.variantMetadataMismatches === 1 ? '' : 'es'}`,
            ].join(', ');

            return `- ${file.locale}: ${file.filePath} (${driftSummary})`;
          }),
          `- generated project: ${generatedProjectFile}`,
          ...(options.check ? [`- check: ${hasDrift ? 'failed (locale drift detected)' : 'passed'}`] : []),
        ].join('\n');

  return {
    configFile: absoluteConfigFile,
    defaultLocale,
    locales,
    files: fileReports,
    generatedProjectFile,
    hasDrift,
    report,
  };
}

/**
 * Runs the full local preflight without mutating translation files.
 */
export async function checkLingvaLocalProject(
  configFile: string,
  options: CheckLingvaLocalProjectOptions = {}
): Promise<CheckLingvaLocalProjectOutput> {
  const sync = await syncLingvaLocalFiles(configFile, {
    cwd: options.cwd,
    format: options.format,
    write: false,
    check: true,
  });
  const validation = await validateLingvaProjectFile(sync.configFile, {
    ...options,
    outputFile: undefined,
  });
  const passed = !sync.hasDrift && !validation.shouldFail;
  const outputFile = options.outputFile ? path.resolve(options.cwd ?? process.cwd(), options.outputFile) : undefined;
  const report =
    options.format === 'json'
      ? JSON.stringify(
          {
            configFile: sync.configFile,
            passed,
            sync,
            validation,
          },
          null,
          2
        )
      : [`Lingva check: ${passed ? 'passed' : 'failed'}`, '', sync.report, '', validation.report].join('\n');

  await writeOutputFile(outputFile, report);

  return {
    configFile: sync.configFile,
    passed,
    sync,
    validation,
    report,
    outputFile,
  };
}

export async function scaffoldLingvaMetadata(
  configFile: string,
  options: ScaffoldLingvaMetadataOptions = {}
): Promise<ScaffoldLingvaMetadataOutput> {
  const { config, configFile: absoluteConfigFile } = await loadLingvaRuntimeConfig(configFile, options.cwd);

  if (!isFileBackedLingvaRuntimeConfig(config)) {
    throw new Error(
      `Lingva metadata requires a runtime config with locales[] and translationFiles in "${absoluteConfigFile}".`
    );
  }

  const locales = Array.from(new Set(config.locales.map((locale) => locale.trim()).filter(Boolean)));
  const defaultLocale = (config.defaultLocale ?? config.locale ?? locales[0] ?? 'en').trim();
  const defaultLocaleFile = resolveConfigRelativePath(absoluteConfigFile, config.translationFiles, defaultLocale);
  const defaultDictionary = sortDictionaryKeys(await readLingvaDictionaryFile(defaultLocaleFile));
  const keys = Object.keys(flattenLingvaCliDictionary(defaultDictionary)).sort((left, right) =>
    left.localeCompare(right)
  );
  const outputFile = path.resolve(
    options.cwd ?? process.cwd(),
    options.outputFile ?? path.join(path.dirname(absoluteConfigFile), config.metadataFile ?? DEFAULT_METADATA_FILE)
  );
  const existingFileMetadata = await readLingvaMetadataFile(outputFile);
  const existingMetadata = {
    ...existingFileMetadata,
    ...(await readLingvaConfigMetadata(config, absoluteConfigFile)),
  };
  const metadata = Object.fromEntries(
    keys.map((key) => [key, existingMetadata[key] ?? createDefaultLingvaKeyMetadata(key, options.defaultStatus)])
  ) as Record<string, NonNullable<LingvaRuntimeConfig<LingvaResources>['keyMetadata']>[string]>;
  const sortedMetadata = sortRecord(metadata) as ScaffoldLingvaMetadataOutput['metadata'];
  const write = options.write ?? true;
  const missingKeys = keys.filter((key) => !existingMetadata[key]);
  const hasDrift = missingKeys.length > 0;

  if (write) {
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, `${JSON.stringify(sortedMetadata, null, 2)}\n`, 'utf8');
  }

  const added = missingKeys.length;
  const preserved = keys.length - added;
  const report =
    options.format === 'json'
      ? JSON.stringify(
          {
            configFile: absoluteConfigFile,
            defaultLocale,
            outputFile,
            keyCount: keys.length,
            added,
            missingKeys,
            preserved,
            written: write,
            hasDrift,
            metadata: sortedMetadata,
          },
          null,
          2
        )
      : [
          `Lingva metadata: ${write ? 'wrote' : 'planned'} ${keys.length} key(s)`,
          `- config: ${absoluteConfigFile}`,
          `- default locale: ${defaultLocale}`,
          `- output: ${outputFile}`,
          `- added: ${added}`,
          `- preserved: ${preserved}`,
          ...(hasDrift && !write ? [`- missing keys: ${missingKeys.join(', ')}`] : []),
        ].join('\n');

  return {
    configFile: absoluteConfigFile,
    defaultLocale,
    outputFile,
    keyCount: keys.length,
    added,
    missingKeys,
    preserved,
    written: write,
    metadata: sortedMetadata,
    hasDrift,
    report,
  };
}

export async function applyLingvaLocalDictionary(
  configFile: string,
  options: ApplyLingvaLocalDictionaryOptions
): Promise<ApplyLingvaLocalDictionaryOutput> {
  const { config, configFile: absoluteConfigFile } = await loadLingvaRuntimeConfig(configFile, options.cwd);

  if (!isFileBackedLingvaRuntimeConfig(config)) {
    throw new Error(
      `Lingva apply requires a runtime config with locales[] and translationFiles in "${absoluteConfigFile}".`
    );
  }

  const locale = options.locale.trim();
  const locales = Array.from(new Set(config.locales.map((item) => item.trim()).filter(Boolean)));
  const defaultLocale = (config.defaultLocale ?? config.locale ?? locales[0] ?? 'en').trim();

  if (!locales.includes(locale)) {
    throw new Error(
      `Locale "${locale}" is not configured in "${absoluteConfigFile}". Expected one of: ${locales.join(', ')}.`
    );
  }

  const absoluteInputFile = path.isAbsolute(options.inputFile)
    ? options.inputFile
    : path.resolve(options.cwd ?? process.cwd(), options.inputFile);
  const rawInput = await fs.readFile(absoluteInputFile, 'utf8');
  const parsedInput = JSON.parse(rawInput) as unknown;

  if (!isPlainObject(parsedInput)) {
    throw new Error(`File "${absoluteInputFile}" must contain a JSON object.`);
  }

  const localeFilePath = resolveConfigRelativePath(absoluteConfigFile, config.translationFiles, locale);
  const nextDictionary = sortDictionaryKeys(parsedInput as LingvaDictionary);

  if (locale !== defaultLocale) {
    const defaultLocaleFile = resolveConfigRelativePath(absoluteConfigFile, config.translationFiles, defaultLocale);
    const defaultDictionary = sortDictionaryKeys(await readLingvaDictionaryFile(defaultLocaleFile));
    const mergedDictionary = mergeMissingKeysFromSource(defaultDictionary, nextDictionary);

    await fs.mkdir(path.dirname(localeFilePath), { recursive: true });
    await fs.writeFile(localeFilePath, `${JSON.stringify(mergedDictionary, null, 2)}\n`, 'utf8');

    const report =
      options.format === 'json'
        ? JSON.stringify(
            {
              configFile: absoluteConfigFile,
              locale,
              filePath: localeFilePath,
              inputFile: absoluteInputFile,
              synced: false,
            },
            null,
            2
          )
        : [
            `Lingva apply: wrote locale ${locale}`,
            `- input: ${absoluteInputFile}`,
            `- file: ${localeFilePath}`,
            `- sync: skipped (non-default locale)`,
          ].join('\n');

    return {
      configFile: absoluteConfigFile,
      locale,
      filePath: localeFilePath,
      inputFile: absoluteInputFile,
      synced: false,
      report,
    };
  }

  const currentDefaultDictionary = sortDictionaryKeys(await readLingvaDictionaryFile(localeFilePath));
  const mergedDefaultDictionary = mergeDictionaryPatch(currentDefaultDictionary, nextDictionary);

  await fs.mkdir(path.dirname(localeFilePath), { recursive: true });
  await fs.writeFile(localeFilePath, `${JSON.stringify(mergedDefaultDictionary, null, 2)}\n`, 'utf8');

  const shouldSync = options.sync ?? true;
  const syncResult = shouldSync
    ? await syncLingvaLocalFiles(absoluteConfigFile, {
        cwd: path.dirname(absoluteConfigFile),
        format: 'text',
        write: true,
      })
    : undefined;

  const report =
    options.format === 'json'
      ? JSON.stringify(
          {
            configFile: absoluteConfigFile,
            locale,
            filePath: localeFilePath,
            inputFile: absoluteInputFile,
            synced: shouldSync,
            generatedProjectFile: syncResult?.generatedProjectFile,
          },
          null,
          2
        )
      : [
          `Lingva apply: wrote locale ${locale}`,
          `- input: ${absoluteInputFile}`,
          `- file: ${localeFilePath}`,
          `- sync: ${shouldSync ? 'completed' : 'skipped'}`,
          ...(syncResult ? [`- generated project: ${syncResult.generatedProjectFile}`] : []),
        ].join('\n');

  return {
    configFile: absoluteConfigFile,
    locale,
    filePath: localeFilePath,
    inputFile: absoluteInputFile,
    synced: shouldSync,
    generatedProjectFile: syncResult?.generatedProjectFile,
    report,
  };
}

interface ApproveDraftSource {
  absoluteDraftFile?: string;
  parsedDraft: {
    authorId?: string;
    environment?: string;
    key?: string;
    locale?: string;
    projectId?: string;
    value?: string;
    variantId?: string;
  };
}

function validateApproveDraftOptions(options: ApproveLingvaDraftOptions): void {
  if (!options.draftFile && !options.draftId)
    throw new Error('Lingva approve requires either --draft <file> or --draft-id <id>.');
  if (options.draftFile && options.draftId)
    throw new Error('Lingva approve accepts either --draft <file> or --draft-id <id>, not both.');
}

async function resolveApproveDraftSource(
  absoluteConfigFile: string,
  options: ApproveLingvaDraftOptions
): Promise<ApproveDraftSource> {
  if (!options.draftFile) {
    return {
      parsedDraft: await resolveHostedLingvaDraft(absoluteConfigFile, {
        cwd: options.cwd,
        apiUrl: options.apiUrl,
        authToken: options.authToken,
        environment: options.environment,
        draftId: options.draftId ?? '',
        limit: options.hostedDraftLimit,
      }),
    };
  }
  const absoluteDraftFile = path.resolve(options.cwd ?? process.cwd(), options.draftFile);
  return {
    absoluteDraftFile,
    parsedDraft: JSON.parse(await fs.readFile(absoluteDraftFile, 'utf8')) as ApproveDraftSource['parsedDraft'],
  };
}

function assertDraftLocaleConfigured(
  locale: string,
  configuredLocales: readonly string[],
  absoluteConfigFile: string
): void {
  const locales = Array.from(new Set(configuredLocales.map((item) => item.trim()).filter(Boolean)));
  if (!locales.includes(locale))
    throw new Error(
      `Draft locale "${locale}" is not configured in "${absoluteConfigFile}". Expected one of: ${locales.join(', ')}.`
    );
}

function resolveApproveExecutionFlags(options: ApproveLingvaDraftOptions) {
  return {
    dryRun: options.dryRun ?? false,
    invalidate: options.invalidate ?? false,
    shouldMarkHostedDraft: Boolean(options.draftId) && (options.markHostedDraftApproved ?? true),
    shouldPush: options.push ?? false,
    shouldSync: options.sync ?? true,
  };
}

function formatApproveLingvaDraftReport(input: {
  absoluteConfigFile: string;
  absoluteDraftFile?: string;
  draft: ApproveLingvaDraftOutput['draft'];
  draftId?: string;
  dryRun: boolean;
  filePath: string;
  format?: 'text' | 'json';
  generatedProjectFile?: string;
  hostedApproval?: ApproveLingvaDraftOutput['hostedApproval'];
  invalidate: boolean;
  push?: PushLingvaProjectOutput;
  shouldMarkHostedDraft: boolean;
  shouldPush: boolean;
  shouldSync: boolean;
}): string {
  if (input.format === 'json') {
    return JSON.stringify(
      {
        configFile: input.absoluteConfigFile,
        draft: input.draft,
        filePath: input.filePath,
        synced: input.shouldSync,
        dryRun: input.dryRun,
        hostedApproval: input.hostedApproval,
        push: input.push,
        generatedProjectFile: input.generatedProjectFile,
        planned: input.dryRun
          ? {
              writeFile: input.filePath,
              sync: input.shouldSync,
              markHostedDraftApproved: input.shouldMarkHostedDraft,
              push: input.shouldPush,
              invalidate: input.invalidate,
            }
          : undefined,
      },
      null,
      2
    );
  }
  const executionStatus = input.dryRun ? 'planned' : 'completed';
  return [
    `Lingva approve${input.dryRun ? ' plan' : ''}: ${input.draft.locale}:${input.draft.key}${input.draft.variantId ? `#${input.draft.variantId}` : ''}`,
    input.absoluteDraftFile ? `- draft: ${input.absoluteDraftFile}` : `- hosted draft: ${input.draftId}`,
    `- file: ${input.filePath}${input.dryRun ? ' [planned]' : ''}`,
    `- sync: ${input.shouldSync ? executionStatus : 'skipped'}`,
    ...(input.shouldMarkHostedDraft
      ? [`- hosted status: ${input.dryRun ? 'planned approved' : input.hostedApproval?.status}`]
      : []),
    ...(input.shouldPush ? [`- push: ${executionStatus}`] : []),
    ...(input.invalidate ? [`- invalidate: ${executionStatus}`] : []),
    ...(input.generatedProjectFile ? [`- generated project: ${input.generatedProjectFile}`] : []),
    ...(input.push ? [`\n${input.push.report}`] : []),
  ].join('\n');
}

export async function approveLingvaDraft(
  configFile: string,
  options: ApproveLingvaDraftOptions
): Promise<ApproveLingvaDraftOutput> {
  const { config, configFile: absoluteConfigFile } = await loadLingvaRuntimeConfig(configFile, options.cwd);

  if (!isFileBackedLingvaRuntimeConfig(config)) {
    throw new Error(
      `Lingva approve requires a runtime config with locales[] and translationFiles in "${absoluteConfigFile}".`
    );
  }

  validateApproveDraftOptions(options);
  const { absoluteDraftFile, parsedDraft } = await resolveApproveDraftSource(absoluteConfigFile, options);
  const draft = createLingvaRemoteAuthoringDraftPayload(
    {
      locale: parsedDraft.locale ?? '',
      key: parsedDraft.key ?? '',
      value: parsedDraft.value ?? '',
      variantId: parsedDraft.variantId,
    },
    {
      authorId: parsedDraft.authorId,
      environment: parsedDraft.environment ?? config.environment,
      projectId: parsedDraft.projectId ?? config.projectId,
    }
  );
  assertDraftLocaleConfigured(draft.locale, config.locales, absoluteConfigFile);

  const localeFilePath = resolveConfigRelativePath(absoluteConfigFile, config.translationFiles, draft.locale);
  const currentDictionary = await readLingvaDictionaryFile(localeFilePath);
  const nextDictionary = sortDictionaryKeys(applyLingvaTranslationEdit(currentDictionary, draft));
  const { dryRun, invalidate, shouldMarkHostedDraft, shouldPush, shouldSync } = resolveApproveExecutionFlags(options);

  if (!dryRun) {
    await fs.mkdir(path.dirname(localeFilePath), { recursive: true });
    await fs.writeFile(localeFilePath, `${JSON.stringify(nextDictionary, null, 2)}\n`, 'utf8');
  }

  if (shouldPush && !shouldSync) {
    throw new Error('Lingva approve --push requires sync to stay enabled.');
  }

  const syncResult = shouldSync
    ? await syncLingvaLocalFiles(absoluteConfigFile, {
        cwd: path.dirname(absoluteConfigFile),
        format: 'text',
        write: !dryRun,
      })
    : undefined;
  const hostedApproval =
    shouldMarkHostedDraft && !dryRun
      ? await markHostedLingvaDraftApproved(absoluteConfigFile, {
          cwd: options.cwd,
          apiUrl: options.apiUrl,
          authToken: options.authToken,
          environment: options.environment ?? draft.environment,
          draftId: options.draftId ?? '',
          approvedBy: options.approvedBy,
        })
      : undefined;
  const pushResult =
    shouldPush && syncResult && !dryRun
      ? await pushLingvaProject(syncResult.generatedProjectFile, {
          cwd: path.dirname(absoluteConfigFile),
          outputDir: options.pushOutputDir,
          locales: options.publishLocales,
          format: options.format,
          includeSummary: true,
          includeMetadata: options.includeMetadata,
          apiUrl: options.publishApiUrl,
          authToken: options.publishAuthToken,
          force: options.forcePush,
          invalidate: options.invalidate,
          invalidateApiUrl: options.invalidateApiUrl,
          invalidateAuthToken: options.invalidateAuthToken,
          invalidateEnvironment: options.invalidateEnvironment,
          invalidateSource: options.invalidateSource ?? LINGVA_DELIVERY_SOURCES.repository,
          invalidateReason: options.invalidateReason,
        })
      : undefined;
  const report = formatApproveLingvaDraftReport({
    absoluteConfigFile,
    absoluteDraftFile,
    draft,
    draftId: options.draftId,
    dryRun,
    filePath: localeFilePath,
    format: options.format,
    generatedProjectFile: syncResult?.generatedProjectFile,
    hostedApproval,
    invalidate,
    push: pushResult,
    shouldMarkHostedDraft,
    shouldPush,
    shouldSync,
  });

  return {
    configFile: absoluteConfigFile,
    draft,
    filePath: localeFilePath,
    synced: shouldSync,
    dryRun,
    hostedApproval,
    push: pushResult,
    generatedProjectFile: syncResult?.generatedProjectFile,
    report,
  };
}

async function resolveHostedLingvaDraft(
  configFile: string,
  options: {
    cwd?: string;
    apiUrl?: string;
    authToken?: string;
    environment?: string;
    draftId: string;
    limit?: number;
  }
) {
  const draftId = options.draftId.trim();

  if (!draftId) {
    throw new Error('Lingva approve requires a non-empty hosted draft id.');
  }

  const result = await listHostedLingvaDrafts(configFile, {
    cwd: options.cwd,
    apiUrl: options.apiUrl,
    authToken: options.authToken,
    environment: options.environment,
    limit: options.limit ?? 100,
    format: 'json',
  });
  const draft = result.drafts.find((item) => item.draftId === draftId);

  if (!draft) {
    throw new Error(`Hosted Lingva draft "${draftId}" was not found in ${result.projectId} (${result.environment}).`);
  }

  return draft;
}

export async function generateLingvaStudio(
  configFile: string,
  options: GenerateLingvaStudioOptions = {}
): Promise<GenerateLingvaStudioOutput> {
  const { config, configFile: absoluteConfigFile } = await loadLingvaRuntimeConfig(configFile, options.cwd);

  if (!isFileBackedLingvaRuntimeConfig(config)) {
    throw new Error(
      `Lingva studio requires a runtime config with locales[] and translationFiles in "${absoluteConfigFile}".`
    );
  }

  const locales = Array.from(new Set(config.locales.map((locale) => locale.trim()).filter(Boolean)));
  const defaultLocale = (config.defaultLocale ?? config.locale ?? locales[0] ?? 'en').trim();

  if (!locales.includes(defaultLocale)) {
    locales.unshift(defaultLocale);
  }

  const dictionaries = Object.fromEntries(
    await Promise.all(
      locales.map(async (locale) => {
        const filePath = resolveConfigRelativePath(absoluteConfigFile, config.translationFiles, locale);
        const dictionary = sortDictionaryKeys(await readLingvaDictionaryFile(filePath));

        return [locale, dictionary];
      })
    )
  ) as Record<string, LingvaDictionary>;

  const tree = buildLingvaStudioTree(dictionaries[defaultLocale] ?? {}, dictionaries, locales);
  const messages = flattenLingvaStudioMessages(tree);
  const summary = {
    totalKeys: messages.length,
    localeCoverage: Object.fromEntries(
      locales.map((locale) => {
        const translated = messages.filter((message) => !message.locales[locale]?.missing).length;
        const missing = messages.length - translated;

        return [
          locale,
          {
            translated,
            missing,
          },
        ];
      })
    ),
  };

  const output: GenerateLingvaStudioOutput = {
    configFile: absoluteConfigFile,
    defaultLocale,
    locales,
    summary,
    tree,
    report: '',
    outputFile: options.outputFile,
  };

  const report =
    options.format === 'json'
      ? JSON.stringify(
          {
            configFile: output.configFile,
            defaultLocale: output.defaultLocale,
            locales: output.locales,
            summary: output.summary,
            tree: output.tree,
          },
          null,
          2
        )
      : formatLingvaStudioHtml(output);

  if (options.outputFile) {
    await fs.mkdir(path.dirname(options.outputFile), { recursive: true });
    await fs.writeFile(options.outputFile, report, 'utf8');
  }

  return {
    ...output,
    report,
  };
}

export async function resolveLingvaCliConfigFile(
  cwd = process.cwd(),
  explicitConfigFile?: string
): Promise<string | undefined> {
  if (explicitConfigFile) {
    return path.isAbsolute(explicitConfigFile) ? explicitConfigFile : path.resolve(cwd, explicitConfigFile);
  }

  for (const fileName of DEFAULT_CONFIG_FILE_NAMES) {
    const candidate = path.resolve(cwd, fileName);

    try {
      const stats = await fs.stat(candidate);

      if (stats.isFile()) {
        return candidate;
      }
    } catch {
      // Config auto-discovery should continue scanning other candidate names.
    }
  }

  return undefined;
}

/**
 * Loads a CLI config from an explicit file or the default config lookup chain.
 */
export async function loadLingvaCliConfig(
  cwd = process.cwd(),
  explicitConfigFile?: string
): Promise<{
  config?: LingvaCliConfig;
  configFile?: string;
}> {
  const configFile = await resolveLingvaCliConfigFile(cwd, explicitConfigFile);

  if (!configFile) {
    return {};
  }

  if (/\.(?:json|ya?ml)$/u.test(configFile)) {
    const raw = await fs.readFile(configFile, 'utf8');
    const parsed = configFile.endsWith('.json') ? (JSON.parse(raw) as unknown) : (parseYaml(raw) as unknown);

    if (!isPlainObject(parsed)) {
      throw new Error(`Lingva CLI config "${configFile}" must export an object.`);
    }

    return {
      config: parsed as LingvaCliConfig,
      configFile,
    };
  }

  const imported = await importLingvaModule(configFile);
  const config = extractLingvaCliConfig(imported.default ?? imported.config);

  if (!config) {
    throw new Error(`Lingva CLI config "${configFile}" must export an object.`);
  }

  return {
    config,
    configFile,
  };
}

/**
 * Merges explicit validation options with config-driven defaults or policies.
 */
export function resolveLingvaCliValidationOptions(
  config: LingvaCliConfig | undefined,
  cliOptions: ValidateProjectOptions,
  policyName?: string
): ValidateProjectOptions {
  const basePolicy = isValidationPolicy(config?.validate) ? config.validate : undefined;
  const selectedPolicy =
    policyName && isPlainObject(config?.validatePolicies) && isValidationPolicy(config.validatePolicies[policyName])
      ? config.validatePolicies[policyName]
      : undefined;

  if (policyName && !selectedPolicy) {
    throw new Error(`Lingva CLI policy "${policyName}" was not found in the loaded config.`);
  }

  return {
    ...basePolicy,
    ...selectedPolicy,
    ...cliOptions,
    // Array options should merge by precedence, not by object spread semantics.
    onlyCodes: cliOptions.onlyCodes ?? selectedPolicy?.onlyCodes ?? basePolicy?.onlyCodes,
    ignoreCodes: cliOptions.ignoreCodes ?? selectedPolicy?.ignoreCodes ?? basePolicy?.ignoreCodes,
  };
}

/**
 * Merges explicit extraction options with config-driven defaults or policies.
 */
export function resolveLingvaCliExtractionOptions(
  config: LingvaCliConfig | undefined,
  cliOptions: ExtractLingvaKeysOptions,
  policyName?: string
): ExtractLingvaKeysOptions {
  const basePolicy = isExtractionPolicy(config?.extract) ? config.extract : undefined;
  const selectedPolicy =
    policyName && isPlainObject(config?.extractPolicies) && isExtractionPolicy(config.extractPolicies[policyName])
      ? config.extractPolicies[policyName]
      : undefined;

  if (policyName && !selectedPolicy) {
    throw new Error(`Lingva CLI extraction policy "${policyName}" was not found in the loaded config.`);
  }

  return {
    ...basePolicy,
    ...selectedPolicy,
    ...cliOptions,
    failOn: cliOptions.failOn ?? selectedPolicy?.failOn ?? basePolicy?.failOn,
    extensions: cliOptions.extensions ?? selectedPolicy?.extensions ?? basePolicy?.extensions,
  };
}

/**
 * Merges explicit publish options with config-driven defaults.
 */
export function resolveLingvaCliPublishOptions(
  config: LingvaCliConfig | undefined,
  cliOptions: PublishLingvaProjectOptions
): PublishLingvaProjectOptions {
  const baseConfig = isPublishConfig(config?.publish) ? config.publish : undefined;

  return {
    ...baseConfig,
    ...cliOptions,
    apiUrl: cliOptions.apiUrl ?? baseConfig?.apiUrl ?? config?.apiUrl,
    authToken:
      cliOptions.authToken ?? baseConfig?.authToken ?? (config?.apiKeyEnv ? process.env[config.apiKeyEnv] : undefined),
    locales: cliOptions.locales ?? undefined,
  };
}

/**
 * Merges explicit invalidation options with config-driven defaults.
 */
export function resolveLingvaCliInvalidateOptions(
  config: LingvaCliConfig | undefined,
  cliOptions: InvalidateLingvaProjectOptions
): InvalidateLingvaProjectOptions {
  const baseConfig = isInvalidateConfig(config?.invalidate) ? config.invalidate : undefined;

  return {
    ...baseConfig,
    ...cliOptions,
    apiUrl: cliOptions.apiUrl ?? baseConfig?.apiUrl ?? config?.apiUrl,
    authToken:
      cliOptions.authToken ?? baseConfig?.authToken ?? (config?.apiKeyEnv ? process.env[config.apiKeyEnv] : undefined),
    source: cliOptions.source ?? baseConfig?.source ?? LINGVA_DELIVERY_SOURCES.manual,
  };
}

/**
 * Merges explicit hosted authoring options with config-driven defaults.
 */
export function resolveLingvaCliAuthoringOptions(
  config: LingvaCliConfig | undefined,
  cliOptions: ListHostedLingvaDraftsOptions
): ListHostedLingvaDraftsOptions {
  const baseConfig = isAuthoringConfig(config?.authoring) ? config.authoring : undefined;

  return {
    ...baseConfig,
    ...cliOptions,
    apiUrl: cliOptions.apiUrl ?? baseConfig?.apiUrl ?? config?.apiUrl,
    authToken:
      cliOptions.authToken ?? baseConfig?.authToken ?? (config?.apiKeyEnv ? process.env[config.apiKeyEnv] : undefined),
  };
}

interface HostedLingvaDraftApproval {
  ok: boolean;
  draftId: string;
  status: LingvaRemoteAuthoringDraftStatus;
  approvedAt?: string;
}

async function uploadHostedLingvaPublishArtifacts(
  apiUrl: string,
  artifacts: LingvaPublishArtifacts,
  options: Pick<PublishLingvaProjectOptions, 'authToken' | 'baseRevision' | 'force'>
): Promise<NonNullable<PublishLingvaProjectOutput['hostedPublish']>> {
  const payload = await postHostedLingvaControlPlaneRequest<NonNullable<PublishLingvaProjectOutput['hostedPublish']>>(
    apiUrl,
    {
      action: LINGVA_HOSTED_CONTROL_PLANE_ACTIONS.publish,
      manifest: artifacts.manifest,
      bundles: artifacts.bundles,
      mutationId: createLingvaPublishMutationId(artifacts),
      ...(options.force ? {} : { baseRevision: options.baseRevision ?? null }),
    },
    options
  );

  if (!payload || typeof payload !== 'object' || !payload.publishId || !payload.projectId || !payload.manifestKey) {
    throw new Error('Lingva hosted publish returned an invalid response payload.');
  }

  return {
    apiUrl,
    publishId: payload.publishId,
    projectId: payload.projectId,
    environment: payload.environment,
    publishedAt: payload.publishedAt,
    manifestKey: payload.manifestKey,
    bundleKeys: payload.bundleKeys,
  };
}

async function postHostedLingvaControlPlaneRequest<Result extends Record<string, unknown>>(
  apiUrl: string,
  payload: Record<string, unknown>,
  options: { authToken?: string }
): Promise<Result> {
  const fetcher = globalThis.fetch;

  if (!fetcher) {
    throw new Error('Hosted Lingva control-plane requests require a fetch implementation.');
  }

  const headers = new Headers({
    'content-type': 'application/json',
  });

  if (options.authToken) {
    headers.set('authorization', `Bearer ${options.authToken}`);
  }

  const response = await fetcher(apiUrl, {
    method: LINGVA_HTTP_METHODS.post,
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const raw = (await response.text()).trim();
    throw new Error(
      `Lingva hosted control-plane request failed with ${response.status} ${response.statusText}${raw ? `: ${raw}` : '.'}`
    );
  }

  return (await response.json()) as Result;
}

function parseHostedLingvaDraftApproval(value: unknown): HostedLingvaDraftApproval {
  if (!isPlainObject(value)) {
    throw new Error('Lingva hosted draft approval response must be an object.');
  }

  if (value.ok !== true) {
    throw new Error('Lingva hosted draft approval response must include ok: true.');
  }

  if (typeof value.draftId !== 'string' || value.draftId.trim().length === 0) {
    throw new Error('Lingva hosted draft approval response must include draftId.');
  }

  if (value.status !== LINGVA_REMOTE_AUTHORING_DRAFT_STATUSES.approved) {
    throw new Error('Lingva hosted draft approval response must include status: approved.');
  }

  return {
    ok: true,
    draftId: value.draftId.trim(),
    status: LINGVA_REMOTE_AUTHORING_DRAFT_STATUSES.approved,
    approvedAt: typeof value.approvedAt === 'string' ? value.approvedAt : undefined,
  };
}

async function markHostedLingvaDraftApproved(
  configFile: string,
  options: {
    cwd?: string;
    apiUrl?: string;
    authToken?: string;
    environment?: string;
    draftId: string;
    approvedBy?: string;
  }
): Promise<HostedLingvaDraftApproval> {
  const { config, configFile: absoluteConfigFile } = await loadLingvaRuntimeConfig(configFile, options.cwd);
  const projectId = config.projectId?.trim();
  const environment = (options.environment ?? config.environment ?? 'default').trim();

  if (!projectId) {
    throw new Error(`Lingva hosted draft approval requires projectId in "${absoluteConfigFile}".`);
  }

  if (!options.apiUrl) {
    throw new Error('Lingva hosted draft approval requires a hosted --api-url or config.authoring.apiUrl.');
  }

  return parseHostedLingvaDraftApproval(
    await postHostedLingvaControlPlaneRequest<Record<string, unknown>>(
      options.apiUrl,
      {
        action: LINGVA_REMOTE_AUTHORING_ACTIONS.approveDraft,
        projectId,
        environment,
        draftId: options.draftId,
        approvedBy: options.approvedBy,
      },
      {
        authToken: options.authToken,
      }
    )
  );
}

function createDraftOutputFileName(draft: { draftId: string; locale: string; key: string; variantId?: string }) {
  const suffix = draft.variantId ? `-${draft.variantId}` : '';
  return `${`${draft.locale}-${draft.key}${suffix}-${draft.draftId}`
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')}.json`;
}

/**
 * Lists hosted authoring drafts for review and can export each draft as a
 * local JSON payload accepted by `lingva approve`.
 */
export async function listHostedLingvaDrafts(
  configFile: string,
  options: ListHostedLingvaDraftsOptions = {}
): Promise<ListHostedLingvaDraftsOutput> {
  const { config, configFile: absoluteConfigFile } = await loadLingvaRuntimeConfig(configFile, options.cwd);
  const projectId = config.projectId?.trim();
  const environment = (options.environment ?? config.environment ?? 'default').trim();

  if (!projectId) {
    throw new Error(`Lingva drafts requires projectId in "${absoluteConfigFile}".`);
  }

  if (!options.apiUrl) {
    throw new Error('Lingva drafts requires a hosted --api-url or config.authoring.apiUrl.');
  }

  const response = await postHostedLingvaControlPlaneRequest<Record<string, unknown>>(
    options.apiUrl,
    {
      action: LINGVA_REMOTE_AUTHORING_ACTIONS.listDrafts,
      projectId,
      environment,
      locale: options.locale,
      key: options.key,
      limit: options.limit,
      nextToken: options.nextToken,
      status: options.status,
      includeApproved: options.status === LINGVA_REMOTE_AUTHORING_DRAFT_REVIEW_STATUSES.all ? true : undefined,
    },
    {
      authToken: options.authToken,
    }
  );
  const parsed = parseLingvaRemoteAuthoringDraftsResponse(response);
  const outputDir = options.outputDir ? path.resolve(options.cwd ?? process.cwd(), options.outputDir) : undefined;
  const outputFiles: string[] = [];

  if (outputDir) {
    await fs.mkdir(outputDir, { recursive: true });

    for (const draft of parsed.drafts) {
      const outputFile = path.join(outputDir, createDraftOutputFileName(draft));
      await fs.writeFile(outputFile, `${JSON.stringify(draft, null, 2)}\n`, 'utf8');
      outputFiles.push(outputFile);
    }
  }

  const report =
    options.format === 'json'
      ? JSON.stringify(
          {
            configFile: absoluteConfigFile,
            projectId,
            environment,
            status: options.status ?? LINGVA_REMOTE_AUTHORING_DRAFT_STATUSES.draft,
            drafts: parsed.drafts,
            nextToken: parsed.nextToken,
            outputFiles,
          },
          null,
          2
        )
      : [
          `Lingva drafts: ${parsed.drafts.length} hosted ${
            options.status ?? LINGVA_REMOTE_AUTHORING_DRAFT_STATUSES.draft
          } draft(s) for ${projectId} (${environment})`,
          ...parsed.drafts.map((draft) => {
            const variant = draft.variantId ? `#${draft.variantId}` : '';
            const author = draft.authorId ? ` by ${draft.authorId}` : '';
            const status = draft.status ? ` [${draft.status}]` : '';

            return `- ${draft.draftId}: ${draft.locale}:${draft.key}${variant}${status}${author}`;
          }),
          ...(parsed.nextToken ? [`Next page token: ${parsed.nextToken}`] : []),
          ...(outputFiles.length > 0 ? [`Exported ${outputFiles.length} draft file(s) to ${outputDir}`] : []),
        ].join('\n');

  return {
    configFile: absoluteConfigFile,
    projectId,
    environment,
    status: options.status ?? LINGVA_REMOTE_AUTHORING_DRAFT_STATUSES.draft,
    drafts: parsed.drafts,
    nextToken: parsed.nextToken,
    outputFiles,
    report,
  };
}

/**
 * Validates a single Lingva project file and formats the result for local use or CI.
 */
export async function validateLingvaProjectFile(
  projectFile: string,
  options: ValidateProjectOptions = {}
): Promise<ValidateProjectOutput> {
  const project = await loadLingvaProject(projectFile, options.cwd);
  const result = createValidationResult(filterIssues(validateLingvaProject(project).issues, options));
  const report = formatLingvaValidationReport(result, options);
  const shouldFail = shouldFailLingvaValidation(result, options.failOn);
  const outputFile = options.outputFile ? path.resolve(options.cwd ?? process.cwd(), options.outputFile) : undefined;

  if (outputFile) {
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, report, 'utf8');
  }

  return {
    report,
    valid: result.valid,
    shouldFail,
    outputFile,
  };
}

/**
 * Validates multiple project files and emits an aggregate report.
 */
export async function validateLingvaProjects(
  inputPath: string,
  options: ValidateProjectOptions = {}
): Promise<ValidateProjectsOutput> {
  const projectFiles = await resolveLingvaProjectFiles(inputPath, options);

  if (projectFiles.length === 0) {
    throw new Error(`No Lingva project files matched in "${inputPath}".`);
  }

  const results = await Promise.all(
    projectFiles.map(async (projectFile) => {
      const project = await loadLingvaProject(projectFile, options.cwd);
      const result = createValidationResult(filterIssues(validateLingvaProject(project).issues, options));
      const report = formatLingvaValidationReport(result, options);

      return {
        projectFile,
        result,
        report,
        shouldFail: shouldFailLingvaValidation(result, options.failOn),
      };
    })
  );

  const format = options.format ?? 'text';
  const includeSummary = options.includeSummary ?? true;
  const outputFile = options.outputFile ? path.resolve(options.cwd ?? process.cwd(), options.outputFile) : undefined;
  const allIssues = results.flatMap((item) => item.result.issues);
  const severityCounts: Record<LingvaProjectValidationSeverity, number> = {
    error: allIssues.filter((issue) => issue.severity === 'error').length,
    warning: allIssues.filter((issue) => issue.severity === 'warning').length,
    info: allIssues.filter((issue) => issue.severity === 'info').length,
  };
  const codeCounts = allIssues.reduce<Record<string, number>>((accumulator, issue) => {
    accumulator[issue.code] = (accumulator[issue.code] ?? 0) + 1;

    return accumulator;
  }, {});

  let report: string;

  if (format === 'json') {
    report = JSON.stringify(
      {
        projectCount: results.length,
        valid: results.every((item) => item.result.valid),
        severityCounts,
        codeCounts,
        results: results.map((item) => ({
          projectFile: item.projectFile,
          ...item.result,
        })),
      },
      null,
      2
    );
  } else {
    const sections: string[] = [];

    if (includeSummary) {
      const failingProjects = results.filter((item) => item.shouldFail).length;
      sections.push(`Lingva batch validation: ${results.length} project(s), ${failingProjects} failing threshold`);
      sections.push(
        `Aggregate issues: ${severityCounts.error} errors, ${severityCounts.warning} warnings, ${severityCounts.info} info`
      );

      if (allIssues.length > 0) {
        sections.push(
          `Issue codes: ${Object.entries(codeCounts)
            .map(([code, count]) => `${code}=${count}`)
            .join(', ')}`
        );
      }
    }

    for (const item of results) {
      sections.push(`Project: ${item.projectFile}`);
      sections.push(item.report);
    }

    report = sections.join('\n\n');
  }

  if (outputFile) {
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, report, 'utf8');
  }

  return {
    report,
    valid: results.every((item) => item.result.valid),
    shouldFail: results.some((item) => item.shouldFail),
    outputFile,
    projectCount: results.length,
    severityCounts,
    codeCounts,
  };
}

/**
 * Generates a manifest report from a project file.
 */
export async function generateLingvaProjectManifest(
  projectFile: string,
  options: GenerateProjectManifestOptions = {}
): Promise<GenerateProjectManifestOutput> {
  const project = await loadLingvaProject(projectFile, options.cwd);
  const manifest = createLingvaProjectManifest(project);
  const report = formatLingvaProjectManifest(manifest, options);
  const outputFile = options.outputFile ? path.resolve(options.cwd ?? process.cwd(), options.outputFile) : undefined;

  if (outputFile) {
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, report, 'utf8');
  }

  return {
    manifest,
    report,
    outputFile,
  };
}

/**
 * Generates a runtime-ready locale bundle from a project file.
 */
export async function generateLingvaProjectBundle(
  projectFile: string,
  options: GenerateProjectBundleOptions
): Promise<GenerateProjectBundleOutput> {
  const project = await loadLingvaProject(projectFile, options.cwd);
  const bundle = createLingvaProjectBundle(project, {
    locale: options.locale,
    includeMetadata: options.includeMetadata,
  });
  const report = formatLingvaProjectBundle(bundle, options);
  const outputFile = options.outputFile ? path.resolve(options.cwd ?? process.cwd(), options.outputFile) : undefined;

  await writeOutputFile(outputFile, report);

  return {
    bundle,
    report,
    outputFile,
  };
}

/**
 * Generates a publish-ready artifact directory with one manifest and one bundle
 * per locale.
 */
export async function publishLingvaProject(
  projectFile: string,
  options: PublishLingvaProjectOptions = {}
): Promise<PublishLingvaProjectOutput> {
  const project = await loadLingvaProject(projectFile, options.cwd);
  const artifacts = createLingvaPublishArtifacts(project, {
    locales: options.locales,
    includeMetadata: options.includeMetadata,
  });
  const report = formatLingvaPublishArtifacts(artifacts, options);
  const outputDir = options.outputDir ? path.resolve(options.cwd ?? process.cwd(), options.outputDir) : undefined;

  if (outputDir) {
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(artifacts.manifest, null, 2), 'utf8');

    for (const bundleDescriptor of artifacts.manifest.bundles) {
      const bundle = artifacts.bundles[bundleDescriptor.locale];
      await fs.writeFile(path.join(outputDir, bundleDescriptor.fileName), JSON.stringify(bundle, null, 2), 'utf8');
    }
  }

  const root = options.cwd ?? process.cwd();
  const environment = artifacts.manifest.environment ?? 'default';
  const locales = artifacts.manifest.bundles.map((bundle) => bundle.locale);
  const projectId = artifacts.manifest.projectId?.trim();
  if (options.apiUrl && !projectId) {
    throw new Error('Lingva hosted publish requires projectId.');
  }
  const state = projectId ? await readLingvaRemoteState(root, projectId, environment) : undefined;
  let baseRevision = options.baseRevision;

  if (options.apiUrl && !options.force && baseRevision === undefined) {
    const revisions = new Set(locales.map((locale) => state?.locales[locale]?.revision).filter(Boolean));
    if (revisions.size > 1) {
      throw new Error('Lingva push found locales from different remote revisions. Pull them together before pushing.');
    }
    baseRevision = revisions.size === 1 ? [...revisions][0] : null;
  }

  const hostedPublish = options.apiUrl?.trim()
    ? await uploadHostedLingvaPublishArtifacts(options.apiUrl, artifacts, { ...options, baseRevision })
    : undefined;

  if (hostedPublish && state) {
    for (const locale of locales) {
      state.locales[locale] = {
        base: sortDictionaryKeys(project.resources[locale] ?? {}),
        revision: hostedPublish.publishId,
      };
    }
    await writeLingvaRemoteState(root, state);
  }

  return {
    artifacts,
    report: hostedPublish
      ? `${report}\nHosted publish: ${hostedPublish.projectId} -> ${hostedPublish.manifestKey}`
      : report,
    outputDir,
    hostedPublish,
  };
}

/**
 * Pushes publish artifacts and optionally triggers hosted invalidation.
 */
export async function pushLingvaProject(
  projectFile: string,
  options: PushLingvaProjectOptions = {}
): Promise<PushLingvaProjectOutput> {
  const publish = await publishLingvaProject(projectFile, options);
  const invalidation = options.invalidate
    ? await invalidateLingvaProject(projectFile, {
        apiUrl: options.invalidateApiUrl ?? options.apiUrl,
        authToken: options.invalidateAuthToken ?? options.authToken,
        environment: options.invalidateEnvironment,
        source: options.invalidateSource ?? LINGVA_DELIVERY_SOURCES.repository,
        reason: options.invalidateReason,
        format: options.format,
        cwd: options.cwd,
      })
    : undefined;
  const report = invalidation ? `${publish.report}\n${invalidation.report}` : publish.report;

  return {
    publish,
    invalidation,
    report,
  };
}

/**
 * Triggers a hosted invalidation event for the current published delivery state.
 */
export async function invalidateLingvaProject(
  projectFile: string,
  options: InvalidateLingvaProjectOptions = {}
): Promise<InvalidateLingvaProjectOutput> {
  const project = await loadLingvaProject(projectFile, options.cwd);
  const projectId = project.projectId?.trim();
  const environment = (options.environment ?? project.environment ?? 'default').trim();

  if (!projectId) {
    throw new Error(
      `Lingva invalidation requires project.projectId in "${projectFile}" or an explicit project-bound config.`
    );
  }

  if (!options.apiUrl) {
    throw new Error('Lingva invalidation requires a hosted --api-url or config.invalidate.apiUrl.');
  }

  const invalidation = await postHostedLingvaControlPlaneRequest<InvalidateLingvaProjectOutput['invalidation']>(
    options.apiUrl,
    {
      action: LINGVA_HOSTED_CONTROL_PLANE_ACTIONS.invalidate,
      projectId,
      environment,
      source: options.source ?? LINGVA_DELIVERY_SOURCES.manual,
      reason: options.reason,
    },
    {
      authToken: options.authToken,
    }
  );

  const report =
    options.format === 'json'
      ? JSON.stringify(invalidation, null, 2)
      : `Lingva invalidation: ${invalidation.projectId} (${invalidation.environment}) -> ${invalidation.invalidationId} [${invalidation.source}]`;

  return {
    report,
    invalidation,
  };
}

/**
 * Generates a workflow summary report from project metadata.
 */
export async function generateLingvaProjectWorkflow(
  projectFile: string,
  options: GenerateProjectWorkflowOptions = {}
): Promise<GenerateProjectWorkflowOutput> {
  const project = await loadLingvaProject(projectFile, options.cwd);
  const summary = createLingvaWorkflowSummary(project);
  const report = formatLingvaWorkflowSummary(summary, options);
  const outputFile = options.outputFile ? path.resolve(options.cwd ?? process.cwd(), options.outputFile) : undefined;

  await writeOutputFile(outputFile, report);

  return {
    summary,
    report,
    outputFile,
  };
}

/**
 * Generates a TypeScript artifact from a project manifest.
 */
export async function generateLingvaProjectTypes(
  projectFile: string,
  options: GenerateProjectTypesOptions = {}
): Promise<GenerateProjectTypesOutput> {
  const project = await loadLingvaProject(projectFile, options.cwd);
  const manifest = createLingvaProjectManifest(project);
  const report = formatLingvaProjectTypeScriptModule(manifest, options);
  const outputFile = options.outputFile ? path.resolve(options.cwd ?? process.cwd(), options.outputFile) : undefined;

  if (outputFile) {
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, report, 'utf8');
  }

  return {
    manifest,
    report,
    outputFile,
  };
}

/**
 * Generates helper functions from a project manifest.
 */
export async function generateLingvaProjectHelpers(
  projectFile: string,
  options: GenerateProjectHelpersOptions = {}
): Promise<GenerateProjectHelpersOutput> {
  const project = await loadLingvaProject(projectFile, options.cwd);
  const manifest = createLingvaProjectManifest(project);
  const report = formatLingvaProjectHelpersModule(manifest, options);
  const outputFile = options.outputFile ? path.resolve(options.cwd ?? process.cwd(), options.outputFile) : undefined;

  if (outputFile) {
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, report, 'utf8');
  }

  return {
    manifest,
    report,
    outputFile,
  };
}

/**
 * Exports a project into a normalized JSON-friendly payload.
 */
export async function exportLingvaProject(
  projectFile: string,
  options: ExportLingvaProjectOptions = {}
): Promise<ExportLingvaProjectOutput> {
  const project = await loadLingvaProject(projectFile, options.cwd);
  // Keep export payloads JSON-friendly so they can move through CI artifacts,
  // scripts, and future sync tooling without runtime-specific wrappers.
  const payload = sortRecord({
    projectId: project.projectId,
    defaultLocale: project.defaultLocale,
    fallbackLocale: project.fallbackLocale,
    resources: project.resources,
    keyMetadata: project.getKeyMetadataMap(),
  }) as Record<string, unknown>;
  const report = JSON.stringify(payload, null, 2);
  const outputFile = options.outputFile ? path.resolve(options.cwd ?? process.cwd(), options.outputFile) : undefined;

  await writeOutputFile(outputFile, report);

  return {
    payload,
    report,
    outputFile,
  };
}

/**
 * Imports normalized resource payloads, optionally merging them with an existing project.
 */
export async function importLingvaResources(
  inputFile: string,
  options: ImportLingvaResourcesOptions = {}
): Promise<ImportLingvaResourcesOutput> {
  const absolutePath = path.isAbsolute(inputFile) ? inputFile : path.resolve(options.cwd ?? process.cwd(), inputFile);
  const raw = await fs.readFile(absolutePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  const importedResources = isPlainObject(parsed) && 'resources' in parsed ? parsed.resources : parsed;

  if (!isLingvaResourcesShape(importedResources)) {
    throw new Error(`File "${absolutePath}" does not contain a valid Lingva resources object.`);
  }

  let payload: Record<string, unknown>;

  if (options.projectFile) {
    const project = await loadLingvaProject(options.projectFile, options.cwd);
    // Merge by locale dictionary so partial imports extend existing locales
    // instead of replacing them wholesale.
    const mergedResources = mergeLingvaResources(project.resources, importedResources);

    payload = sortRecord({
      projectId: project.projectId,
      defaultLocale: project.defaultLocale,
      fallbackLocale: project.fallbackLocale,
      resources: mergedResources,
      keyMetadata: project.getKeyMetadataMap(),
    }) as Record<string, unknown>;
  } else {
    payload = sortRecord({
      resources: importedResources,
    }) as Record<string, unknown>;
  }

  const report = JSON.stringify(payload, null, 2);
  const outputFile = options.outputFile ? path.resolve(options.cwd ?? process.cwd(), options.outputFile) : undefined;

  await writeOutputFile(outputFile, report);

  return {
    payload,
    report,
    outputFile,
  };
}

/**
 * Materializes local bundle files from a runtime config in `delivery.mode = local`.
 */
export async function pullLingvaBundles(
  configFile: string,
  options: PullLingvaBundlesOptions = {}
): Promise<PullLingvaBundlesOutput> {
  const { config, configFile: absoluteConfigFile } = await loadLingvaRuntimeConfig(configFile, options.cwd);
  const project = config.project;

  if (!project && isFileBackedLingvaRuntimeConfig(config)) {
    const apiUrl = options.apiUrl ?? config.apiUrl;
    const projectId = config.projectId?.trim();

    if (!apiUrl || !projectId) {
      throw new Error(
        `Hosted Lingva pull requires projectId and apiUrl in "${absoluteConfigFile}" or an explicit --api-url.`
      );
    }

    const requestedLocales = normalizeCodes(options.locales);
    const availableLocales = [...config.locales];
    const locales = requestedLocales.length > 0 ? requestedLocales : availableLocales;
    const missingLocales = locales.filter((locale) => !availableLocales.includes(locale));

    if (missingLocales.length > 0) {
      throw new Error(`Requested locales are not present in config.locales: ${missingLocales.join(', ')}.`);
    }

    const environment = config.environment ?? 'production';
    const files: string[] = [];
    const stateRoot = path.dirname(absoluteConfigFile);
    const state = await readLingvaRemoteState(stateRoot, projectId, environment);
    const plannedWrites: Array<{
      locale: string;
      mergedDictionary: LingvaDictionary;
      outputPath: string;
      remoteDictionary: LingvaDictionary;
      revision: string;
    }> = [];

    for (const locale of locales) {
      const bundlePath = applyPullTemplate(DEFAULT_REMOTE_BUNDLE_PATH_TEMPLATE, locale, {
        projectId,
        environment,
        apiUrl,
      });
      const headers = new Headers({
        [LINGVA_HTTP_HEADERS.accept]: LINGVA_MEDIA_TYPES.json,
      });

      if (options.authToken) {
        headers.set(LINGVA_HTTP_HEADERS.authorization, `Bearer ${options.authToken}`);
        headers.set(LINGVA_HTTP_HEADERS.apiKey, options.authToken);
      } else if (config.apiKey) {
        headers.set(LINGVA_HTTP_HEADERS.authorization, `Bearer ${config.apiKey}`);
        headers.set(LINGVA_HTTP_HEADERS.apiKey, config.apiKey);
      }

      const response = await fetch(`${apiUrl.replace(/\/$/u, '')}${bundlePath}`, {
        method: LINGVA_HTTP_METHODS.get,
        headers,
      });

      if (!response.ok) {
        const details = (await response.text()).trim();
        throw new Error(
          `Lingva hosted pull failed with ${response.status} ${response.statusText}${details ? `: ${details}` : '.'}`
        );
      }

      const revision = response.headers.get(LINGVA_HTTP_HEADERS.revision);
      if (!revision) {
        throw new Error('Lingva hosted pull response has no revision header.');
      }

      const bundle = (await response.json()) as LingvaProjectBundle;
      const remoteDictionary: LingvaDictionary = {};

      for (const [key, message] of Object.entries(bundle.messages)) {
        if (bundle.sources[key] !== locale) {
          continue;
        }

        const segments = key.split('.');
        const leaf = segments.pop();
        let cursor = remoteDictionary;

        for (const segment of segments) {
          const nested = cursor[segment];
          cursor[segment] = nested && typeof nested === 'object' && !Array.isArray(nested) ? nested : {};
          cursor = cursor[segment] as LingvaDictionary;
        }

        if (leaf) {
          cursor[leaf] = bundle.variants?.[key] ?? message;
        }
      }

      const outputTemplate = options.outputFile ?? config.translationFiles;
      const outputPath = resolveConfigRelativePath(absoluteConfigFile, outputTemplate, locale);
      const localDictionary = await readLingvaDictionaryFile(outputPath);
      const mergedDictionary = mergeLingvaRemoteDictionary(
        locale,
        state.locales[locale]?.base ?? {},
        localDictionary,
        remoteDictionary
      );
      plannedWrites.push({ locale, mergedDictionary, outputPath, remoteDictionary, revision });
      files.push(outputPath);
    }

    for (const write of plannedWrites) {
      await fs.mkdir(path.dirname(write.outputPath), { recursive: true });
      await fs.writeFile(write.outputPath, `${JSON.stringify(write.mergedDictionary, null, 2)}\n`, 'utf8');
      state.locales[write.locale] = { base: sortDictionaryKeys(write.remoteDictionary), revision: write.revision };
    }
    await writeLingvaRemoteState(stateRoot, state);

    const report =
      options.format === LINGVA_SERIALIZATION_FORMATS.json
        ? JSON.stringify({ mode: LINGVA_RUNTIME_MODES.remote, locales, files }, null, 2)
        : [
            ...(options.includeSummary === false
              ? []
              : [`Lingva pull: wrote ${files.length} hosted locale file(s) for ${locales.join(', ')}`]),
            ...files.map((file, index) => `- ${locales[index]} -> ${file}`),
          ].join('\n');

    return { files, locales, mode: LINGVA_RUNTIME_MODES.remote, report };
  }

  if (!project) {
    throw new Error(
      `Lingva pull requires a runtime config with project resources. "${absoluteConfigFile}" does not define project.`
    );
  }

  if (!config.delivery) {
    throw new Error(
      `Lingva pull requires delivery config. Add delivery.mode and delivery.path to "${absoluteConfigFile}".`
    );
  }

  if (config.delivery.mode !== LINGVA_DELIVERY_MODES.local) {
    throw new Error(`Lingva pull currently supports only local delivery mode. Received "${config.delivery.mode}".`);
  }

  const requestedLocales = normalizeCodes(options.locales);
  const availableLocales = Object.keys(project.resources).sort();
  const locales =
    requestedLocales.length > 0
      ? requestedLocales.filter((locale) => availableLocales.includes(locale))
      : availableLocales;
  const missingLocales = requestedLocales.filter((locale) => !availableLocales.includes(locale));

  if (missingLocales.length > 0) {
    throw new Error(`Requested locales are not present in project resources: ${missingLocales.join(', ')}.`);
  }

  const configContext: Pick<LingvaConfig, 'projectId' | 'apiUrl' | 'environment'> = {
    projectId: config.projectId ?? project.projectId,
    apiUrl: config.apiUrl ?? project.apiUrl,
    environment: config.environment ?? project.environment,
  };
  const outputTemplate = options.outputFile ?? config.delivery.path;
  const files: string[] = [];

  for (const locale of locales) {
    const absoluteOutputPath = path.isAbsolute(outputTemplate)
      ? applyPullTemplate(outputTemplate, locale, configContext)
      : path.resolve(path.dirname(absoluteConfigFile), applyPullTemplate(outputTemplate, locale, configContext));
    const payload = {
      projectId: configContext.projectId,
      environment: configContext.environment,
      locale,
      generatedAt: new Date().toISOString(),
      resources: project.resources[locale] ?? {},
    };

    await fs.mkdir(path.dirname(absoluteOutputPath), { recursive: true });
    await fs.writeFile(`${absoluteOutputPath}`, JSON.stringify(payload, null, 2), 'utf8');
    files.push(absoluteOutputPath);
  }

  const format = options.format ?? LINGVA_SERIALIZATION_FORMATS.text;
  const includeSummary = options.includeSummary ?? true;
  const report =
    format === LINGVA_SERIALIZATION_FORMATS.json
      ? JSON.stringify(
          {
            mode: LINGVA_RUNTIME_MODES.local,
            locales,
            files,
          },
          null,
          2
        )
      : [
          ...(includeSummary
            ? [`Lingva pull: wrote ${files.length} local bundle(s) for ${locales.join(', ') || 'no locales'}`]
            : []),
          ...files.map((file, index) => `- ${locales[index]} -> ${file}`),
        ].join('\n');

  return {
    files,
    locales,
    mode: LINGVA_RUNTIME_MODES.local,
    report,
  };
}

/**
 * Scans source files for translation key usage and optionally compares it with a project contract.
 */
export async function extractLingvaKeys(
  inputPath: string,
  options: ExtractLingvaKeysOptions = {}
): Promise<ExtractLingvaKeysOutput> {
  const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.resolve(options.cwd ?? process.cwd(), inputPath);
  const files = await collectFiles(absolutePath);
  const extensions = new Set(normalizeExtensions(options.extensions));
  const excludePatterns = normalizePathPatterns(options.exclude);
  const scannedFiles = files.filter(
    (file) => extensions.has(path.extname(file)) && !shouldExcludeFile(file, excludePatterns)
  );
  const occurrences = new Map<string, Array<{ file: string; line: number }>>();

  for (const file of scannedFiles) {
    const source = await fs.readFile(file, 'utf8');

    for (const occurrence of extractLingvaKeysFromSource(source, file)) {
      const values = occurrences.get(occurrence.key) ?? [];
      values.push({
        file,
        line: occurrence.line,
      });
      occurrences.set(occurrence.key, values);
    }
  }

  const keyOccurrences = Object.fromEntries(
    Array.from(occurrences.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, values]) => [
        key,
        values.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line),
      ])
  );
  const keys = Object.keys(keyOccurrences).sort();
  let matchedKeys = [...keys];
  let missingKeys: string[] = [];
  let unusedProjectKeys: string[] = [];

  if (options.projectFile) {
    const project = await loadLingvaProject(options.projectFile, options.cwd);
    const manifest = createLingvaProjectManifest(project);
    const projectKeys = new Set(manifest.keys);

    matchedKeys = keys.filter((key) => projectKeys.has(key));
    missingKeys = keys.filter((key) => !projectKeys.has(key));
    unusedProjectKeys = manifest.keys.filter((key: string) => !occurrences.has(key));
  }

  const format = options.format ?? 'text';
  const includeSummary = options.includeSummary ?? true;
  const failOn = options.failOn ?? 'none';
  const outputFile = options.outputFile ? path.resolve(options.cwd ?? process.cwd(), options.outputFile) : undefined;
  const failureConditions = {
    missing: () => missingKeys.length > 0,
    none: () => false,
    unused: () => unusedProjectKeys.length > 0,
    any: () => missingKeys.length > 0 || unusedProjectKeys.length > 0,
  } satisfies Record<typeof failOn, () => boolean>;
  const shouldFail = failureConditions[failOn]();

  const payload = {
    scannedFiles,
    keys,
    matchedKeys,
    missingKeys,
    unusedProjectKeys,
    occurrences: keyOccurrences,
    shouldFail,
  };

  const report =
    format === 'json'
      ? JSON.stringify(payload, null, 2)
      : [
          ...(includeSummary
            ? [
                `Lingva extraction: ${keys.length} key(s) across ${scannedFiles.length} file(s)`,
                options.projectFile
                  ? `Matched ${matchedKeys.length}, missing ${missingKeys.length}, unused ${unusedProjectKeys.length}`
                  : undefined,
              ].filter(Boolean)
            : []),
          ...(keys.length > 0
            ? [
                'Keys:',
                ...keys.flatMap((key) => [
                  `- ${key}`,
                  ...(keyOccurrences[key] ?? []).map((occurrence) => `  ${occurrence.file}:${occurrence.line}`),
                ]),
              ]
            : ['No translation keys found.']),
          ...(missingKeys.length > 0 ? ['', 'Missing project keys:', ...missingKeys.map((key) => `- ${key}`)] : []),
          ...(unusedProjectKeys.length > 0
            ? ['', 'Unused project keys:', ...unusedProjectKeys.map((key) => `- ${key}`)]
            : []),
        ].join('\n');

  if (outputFile) {
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, report, 'utf8');
  }

  return {
    ...payload,
    report,
    outputFile,
  };
}
