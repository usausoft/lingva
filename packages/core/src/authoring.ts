import type { LingvaDictionary, LingvaMessageVariant } from './contracts';
import { assertLingvaTranslationKey } from './translation-keys';

export interface LingvaTranslationEditPayload {
  locale: string;
  key: string;
  value: string;
  variantId?: string;
}

export interface LingvaRemoteAuthoringDraftPayload extends LingvaTranslationEditPayload {
  authorId?: string;
  environment: string;
  projectId: string;
}

export interface LingvaRemoteAuthoringDraftResponse {
  draftId?: string;
  ok: boolean;
  [key: string]: unknown;
}

export interface LingvaRemoteAuthoringDraftRecord extends LingvaRemoteAuthoringDraftPayload {
  draftId: string;
  entityKey?: string;
  status?: LingvaRemoteAuthoringDraftStatus;
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface LingvaRemoteAuthoringDraftsResponse {
  ok: boolean;
  count: number;
  drafts: LingvaRemoteAuthoringDraftRecord[];
  nextToken?: string;
  translationKeyQuota?: LingvaTranslationKeyQuota;
  [key: string]: unknown;
}

export interface LingvaTranslationKeyQuota {
  limit?: number;
  remaining?: number;
  used: number;
}

export interface LingvaRemoteAuthoringPayloadOptions {
  authorId?: string;
  environment?: string;
  projectId?: string;
}

export const LINGVA_DEFAULT_AUTHORING_ENVIRONMENT = 'dev';
export const LINGVA_MAX_AUTHORING_VALUE_LENGTH = 20_000;
export const LINGVA_REMOTE_AUTHORING_ACTIONS = {
  approveDraft: 'approve-draft',
  createDraft: 'create-draft',
  deleteKey: 'delete-key',
  listDrafts: 'list-drafts',
} as const;
export const LINGVA_REMOTE_AUTHORING_DRAFT_STATUSES = {
  approved: 'approved',
  draft: 'draft',
} as const;
export const LINGVA_REMOTE_AUTHORING_DRAFT_REVIEW_STATUSES = {
  ...LINGVA_REMOTE_AUTHORING_DRAFT_STATUSES,
  all: 'all',
} as const;
export const LINGVA_REMOTE_AUTHORING_DRAFT_REVIEW_STATUS_VALUES = [
  LINGVA_REMOTE_AUTHORING_DRAFT_REVIEW_STATUSES.draft,
  LINGVA_REMOTE_AUTHORING_DRAFT_REVIEW_STATUSES.approved,
  LINGVA_REMOTE_AUTHORING_DRAFT_REVIEW_STATUSES.all,
] as const;

export type LingvaRemoteAuthoringAction =
  (typeof LINGVA_REMOTE_AUTHORING_ACTIONS)[keyof typeof LINGVA_REMOTE_AUTHORING_ACTIONS];
export type LingvaRemoteAuthoringDraftStatus =
  (typeof LINGVA_REMOTE_AUTHORING_DRAFT_STATUSES)[keyof typeof LINGVA_REMOTE_AUTHORING_DRAFT_STATUSES];
export type LingvaRemoteAuthoringDraftReviewStatus =
  (typeof LINGVA_REMOTE_AUTHORING_DRAFT_REVIEW_STATUSES)[keyof typeof LINGVA_REMOTE_AUTHORING_DRAFT_REVIEW_STATUSES];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function cloneDictionary(dictionary: LingvaDictionary): LingvaDictionary {
  return JSON.parse(JSON.stringify(dictionary)) as LingvaDictionary;
}

function getContainerForPath(dictionary: LingvaDictionary, path: string[]) {
  let current: Record<string, unknown> = dictionary;

  for (const segment of path) {
    const next = current[segment];

    if (next === undefined) {
      const container: Record<string, unknown> = {};
      current[segment] = container;
      current = container;
      continue;
    }

    if (!isRecord(next) || Array.isArray(next)) {
      throw new Error(`Lingva key path "${path.join('.')}" is not editable.`);
    }

    current = next;
  }

  return current;
}

function normalizeOptionalString(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim() : undefined;
  return normalized ? normalized : undefined;
}

function requireStringField(record: Record<string, unknown>, field: string, subject: string): string {
  const value = normalizeOptionalString(record[field]);

  if (!value) {
    throw new Error(`${subject} must include ${field}.`);
  }

  return value;
}

export function isLingvaRemoteAuthoringDraftStatus(value: unknown): value is LingvaRemoteAuthoringDraftStatus {
  return (
    value === LINGVA_REMOTE_AUTHORING_DRAFT_STATUSES.approved || value === LINGVA_REMOTE_AUTHORING_DRAFT_STATUSES.draft
  );
}

export function isLingvaRemoteAuthoringDraftReviewStatus(
  value: unknown
): value is LingvaRemoteAuthoringDraftReviewStatus {
  return isLingvaRemoteAuthoringDraftStatus(value) || value === LINGVA_REMOTE_AUTHORING_DRAFT_REVIEW_STATUSES.all;
}

/**
 * Creates the stable hosted authoring draft payload used by web proxies, CLI
 * tooling, and backend authoring boundaries.
 */
export function createLingvaRemoteAuthoringDraftPayload(
  payload: LingvaTranslationEditPayload,
  options: LingvaRemoteAuthoringPayloadOptions
): LingvaRemoteAuthoringDraftPayload {
  const projectId = normalizeOptionalString(options.projectId);
  const locale = normalizeOptionalString(payload.locale);
  const key = normalizeOptionalString(payload.key);

  if (!projectId) {
    throw new Error('Lingva remote authoring requires a projectId.');
  }

  if (!locale) {
    throw new Error('Lingva remote authoring requires a locale.');
  }

  if (!key) {
    throw new Error('Lingva remote authoring requires a key.');
  }

  assertLingvaTranslationKey(key);

  if (payload.value.length > LINGVA_MAX_AUTHORING_VALUE_LENGTH) {
    throw new Error('Lingva remote authoring value is too large.');
  }

  return {
    locale,
    key,
    value: payload.value,
    variantId: normalizeOptionalString(payload.variantId),
    projectId,
    environment: normalizeOptionalString(options.environment) ?? LINGVA_DEFAULT_AUTHORING_ENVIRONMENT,
    authorId: normalizeOptionalString(options.authorId),
  };
}

/**
 * Validates hosted authoring responses before callers trust draft metadata.
 */
export function parseLingvaRemoteAuthoringDraftResponse(value: unknown): LingvaRemoteAuthoringDraftResponse {
  if (!isRecord(value) || Array.isArray(value)) {
    throw new Error('Lingva remote authoring response must be an object.');
  }

  if (value.ok !== true) {
    throw new Error('Lingva remote authoring response must include ok: true.');
  }

  return value as LingvaRemoteAuthoringDraftResponse;
}

function parseDraftRecord(value: unknown): LingvaRemoteAuthoringDraftRecord {
  if (!isRecord(value) || Array.isArray(value)) {
    throw new Error('Lingva remote authoring draft record must be an object.');
  }

  const payload = createLingvaRemoteAuthoringDraftPayload(
    {
      locale: typeof value.locale === 'string' ? value.locale : '',
      key: typeof value.key === 'string' ? value.key : '',
      value: typeof value.value === 'string' ? value.value : '',
      variantId: typeof value.variantId === 'string' ? value.variantId : undefined,
    },
    {
      authorId: typeof value.authorId === 'string' ? value.authorId : undefined,
      environment: typeof value.environment === 'string' ? value.environment : undefined,
      projectId: typeof value.projectId === 'string' ? value.projectId : undefined,
    }
  );

  const subject = 'Lingva remote authoring draft record';

  return {
    ...payload,
    draftId: requireStringField(value, 'draftId', subject),
    entityKey: normalizeOptionalString(value.entityKey),
    status: isLingvaRemoteAuthoringDraftStatus(value.status) ? value.status : undefined,
    createdAt: requireStringField(value, 'createdAt', subject),
    updatedAt: normalizeOptionalString(value.updatedAt),
    approvedAt: normalizeOptionalString(value.approvedAt),
    approvedBy: normalizeOptionalString(value.approvedBy),
  };
}

/**
 * Validates hosted authoring draft list responses before CLI review tooling
 * trusts the backend payload.
 */
export function parseLingvaRemoteAuthoringDraftsResponse(value: unknown): LingvaRemoteAuthoringDraftsResponse {
  if (!isRecord(value) || Array.isArray(value)) {
    throw new Error('Lingva remote authoring drafts response must be an object.');
  }

  if (value.ok !== true) {
    throw new Error('Lingva remote authoring drafts response must include ok: true.');
  }

  if (!Array.isArray(value.drafts)) {
    throw new Error('Lingva remote authoring drafts response must include drafts[].');
  }

  const drafts = value.drafts.map(parseDraftRecord);
  const rawQuota = isRecord(value.translationKeyQuota) ? value.translationKeyQuota : undefined;
  const used = typeof rawQuota?.used === 'number' && Number.isFinite(rawQuota.used) ? rawQuota.used : undefined;
  const limit = typeof rawQuota?.limit === 'number' && Number.isFinite(rawQuota.limit) ? rawQuota.limit : undefined;
  const remaining =
    typeof rawQuota?.remaining === 'number' && Number.isFinite(rawQuota.remaining) ? rawQuota.remaining : undefined;

  return {
    ...value,
    ok: true,
    count: typeof value.count === 'number' && Number.isFinite(value.count) ? value.count : drafts.length,
    drafts,
    nextToken: typeof value.nextToken === 'string' && value.nextToken.trim() ? value.nextToken.trim() : undefined,
    translationKeyQuota: used === undefined ? undefined : { used, limit, remaining },
  };
}

/**
 * Applies one authoring edit to a nested locale dictionary without mutating the
 * original object. It supports plain string leaves and typed variant arrays.
 */
export function applyLingvaTranslationEdit(
  dictionary: LingvaDictionary,
  payload: LingvaTranslationEditPayload
): LingvaDictionary {
  const nextDictionary = cloneDictionary(dictionary);
  const segments = payload.key.split('.');
  const leafKey = segments.pop();

  if (!leafKey) {
    throw new Error('Lingva key is required.');
  }

  const container = getContainerForPath(nextDictionary, segments);
  const currentValue = container[leafKey];

  if (currentValue === undefined) {
    container[leafKey] = payload.variantId
      ? [{ id: payload.variantId, text: payload.value } satisfies LingvaMessageVariant]
      : payload.value;
    return nextDictionary;
  }

  if (typeof currentValue === 'string') {
    if (payload.variantId) {
      throw new Error(`Key "${payload.key}" does not define translation variants.`);
    }

    container[leafKey] = payload.value;
    return nextDictionary;
  }

  if (Array.isArray(currentValue)) {
    if (!payload.variantId) {
      throw new Error(`Key "${payload.key}" requires a variant id.`);
    }

    const updatedVariants = currentValue.map((entry) => {
      if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.text !== 'string') {
        throw new Error(`Key "${payload.key}" contains an invalid translation variant contract.`);
      }

      if (entry.id !== payload.variantId) {
        return entry;
      }

      return {
        ...(entry as unknown as LingvaMessageVariant),
        text: payload.value,
      };
    });

    const variantExists = updatedVariants.some((entry) => isRecord(entry) && entry.id === payload.variantId);

    container[leafKey] = variantExists
      ? updatedVariants
      : [...updatedVariants, { id: payload.variantId, text: payload.value } satisfies LingvaMessageVariant];
    return nextDictionary;
  }

  throw new Error(`Key "${payload.key}" is not editable.`);
}
