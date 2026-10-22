import { LINGVA_DEPLOYMENT_STAGES, LINGVA_RUNTIME_MODES, type LingvaRuntimeMode } from './constants';

export const LINGVA_HOSTED_PROJECT_ACTIONS = {
  acceptInvite: 'acceptInvite',
  adminUpdateProject: 'adminUpdateProject',
  createApiKey: 'createApiKey',
  createAuditEvent: 'createAuditEvent',
  createInvite: 'createInvite',
  createProject: 'createProject',
  deleteProject: 'deleteProject',
  getPlatformSettings: 'getPlatformSettings',
  listApiKeys: 'listApiKeys',
  listEnvironments: 'listEnvironments',
  listInvites: 'listInvites',
  listAuditEvents: 'listAuditEvents',
  listCustomers: 'listCustomers',
  listMembers: 'listMembers',
  listProjects: 'listProjects',
  revokeApiKey: 'revokeApiKey',
  revokeInvite: 'revokeInvite',
  revokeMember: 'revokeMember',
  updateProject: 'updateProject',
  updatePlatformSettings: 'updatePlatformSettings',
  updateCustomer: 'updateCustomer',
  upsertEnvironment: 'upsertEnvironment',
  upsertMember: 'upsertMember',
} as const;

export const LINGVA_HOSTED_PROJECT_TIERS = ['free', 'plus', 'pro', 'business', 'internal'] as const;
export const LINGVA_HOSTED_CUSTOMER_ROLES = ['admin', 'customer', 'dev', 'staff', 'support'] as const;
export const LINGVA_HOSTED_PROJECT_TIER = {
  business: 'business',
  free: 'free',
  internal: 'internal',
  plus: 'plus',
  pro: 'pro',
} as const;

export const FREE_TIER_LIMITS = {
  maxProjectsPerOwner: 1,
  maxMembersPerProject: 5,
  maxApiKeysPerProject: 3,
  maxTranslationKeysPerProject: 100,
} as const;

/**
 * Maximum active SDK/API credentials allowed per project.
 *
 * Revoked credentials do not consume quota. Existing credentials are never
 * removed when a project moves to a lower tier; creation stays blocked until
 * the active count is below the new tier's limit.
 */
export const LINGVA_HOSTED_API_KEY_LIMITS = {
  [LINGVA_HOSTED_PROJECT_TIER.free]: FREE_TIER_LIMITS.maxApiKeysPerProject,
  [LINGVA_HOSTED_PROJECT_TIER.plus]: 10,
  [LINGVA_HOSTED_PROJECT_TIER.pro]: 50,
  [LINGVA_HOSTED_PROJECT_TIER.business]: 250,
  [LINGVA_HOSTED_PROJECT_TIER.internal]: 1_000,
} as const satisfies Record<(typeof LINGVA_HOSTED_PROJECT_TIERS)[number], number>;

export const LINGVA_HOSTED_ENVIRONMENT_KINDS = ['development', 'staging', 'production', 'custom'] as const;
export const LINGVA_HOSTED_ENVIRONMENT_KIND = {
  custom: 'custom',
  development: 'development',
  production: 'production',
  staging: 'staging',
} as const;

export const LINGVA_HOSTED_PROJECT_DEFAULT_ENVIRONMENTS = ['dev', 'stage', 'prod'] as const;

export const LINGVA_HOSTED_PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,63}$/;
export const LINGVA_HOSTED_LOCALE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]+)*$/i;
export const LINGVA_HOSTED_LOCALE_MAX_LENGTH = 35;
export const LINGVA_HOSTED_ENVIRONMENT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,31}$/;
export const LINGVA_HOSTED_PROJECT_NAME_MAX_LENGTH = 80;
export const LINGVA_HOSTED_PROJECT_DESCRIPTION_MAX_LENGTH = 240;
export const LINGVA_HOSTED_INVITE_EMAIL_MAX_LENGTH = 254;
export const LINGVA_HOSTED_INVITE_NOTE_MAX_LENGTH = 240;
export const LINGVA_HOSTED_INVITE_ROLE_MAX_LENGTH = 48;
export const LINGVA_HOSTED_INVITE_TOKEN_MAX_LENGTH = 256;
export const LINGVA_HOSTED_INVITE_ID_PATTERN = /^invite_[a-z0-9-]{8,96}$/;
export const LINGVA_HOSTED_API_KEY_ID_PATTERN = /^key_[a-z0-9-]{8,96}$/;
export const LINGVA_HOSTED_API_KEY_NAME_MAX_LENGTH = 80;
export const LINGVA_HOSTED_API_KEY_SCOPES = [
  'authoring:write',
  'delivery:read',
  'delivery:write',
  'project:admin',
] as const;
export const LINGVA_HOSTED_API_KEY_SCOPE = {
  authoringWrite: 'authoring:write',
  deliveryRead: 'delivery:read',
  deliveryWrite: 'delivery:write',
  projectAdmin: 'project:admin',
} as const;
export const LINGVA_HOSTED_PROJECT_MEMBER_ROLES = ['owner', 'admin', 'editor', 'viewer'] as const;
export const LINGVA_HOSTED_PROJECT_MEMBER_ROLE = {
  admin: 'admin',
  editor: 'editor',
  owner: 'owner',
  viewer: 'viewer',
} as const;
export const LINGVA_HOSTED_ASSIGNABLE_PROJECT_MEMBER_ROLES = [
  LINGVA_HOSTED_PROJECT_MEMBER_ROLE.admin,
  LINGVA_HOSTED_PROJECT_MEMBER_ROLE.editor,
  LINGVA_HOSTED_PROJECT_MEMBER_ROLE.viewer,
] as const;
export const LINGVA_HOSTED_PROJECT_MEMBER_STATUSES = ['active', 'revoked'] as const;
export const LINGVA_HOSTED_PROJECT_MEMBER_STATUS = {
  active: 'active',
  revoked: 'revoked',
} as const;
export const LINGVA_HOSTED_PROJECT_INVITE_STATUSES = ['active', 'accepted', 'revoked', 'expired'] as const;
export const LINGVA_HOSTED_PROJECT_INVITE_STATUS = {
  accepted: 'accepted',
  active: 'active',
  expired: 'expired',
  revoked: 'revoked',
} as const;
export const LINGVA_HOSTED_PROJECT_API_KEY_STATUSES = ['active', 'revoked'] as const;
export const LINGVA_HOSTED_PROJECT_API_KEY_STATUS = {
  active: 'active',
  revoked: 'revoked',
} as const;
export const LINGVA_HOSTED_PROJECT_MEMBER_USER_ID_MAX_LENGTH = 160;
export const LINGVA_HOSTED_PROJECT_AUDIT_ACTIONS = [
  'apiKey.create',
  'apiKey.revoke',
  'delivery.invalidate',
  'delivery.rollback',
  'delivery.workflow',
  'draft.approve',
  'draft.promote',
  'member.revoke',
  'member.upsert',
  'project.create',
  'project.update',
  'translationKey.delete',
] as const;
export const LINGVA_HOSTED_PROJECT_AUDIT_ACTION = {
  apiKeyCreate: 'apiKey.create',
  apiKeyRevoke: 'apiKey.revoke',
  deliveryInvalidate: 'delivery.invalidate',
  deliveryRollback: 'delivery.rollback',
  deliveryWorkflow: 'delivery.workflow',
  draftApprove: 'draft.approve',
  draftPromote: 'draft.promote',
  memberRevoke: 'member.revoke',
  memberUpsert: 'member.upsert',
  projectCreate: 'project.create',
  projectUpdate: 'project.update',
  translationKeyDelete: 'translationKey.delete',
} as const;
export const LINGVA_HOSTED_PROJECT_AUDIT_TARGET_TYPES = [
  'apiKey',
  'delivery',
  'draft',
  'member',
  'project',
  'translationKey',
] as const;
export const LINGVA_HOSTED_PROJECT_AUDIT_TARGET_TYPE = {
  apiKey: 'apiKey',
  delivery: 'delivery',
  draft: 'draft',
  member: 'member',
  project: 'project',
  translationKey: 'translationKey',
} as const;
export const LINGVA_HOSTED_PROJECT_AUDIT_ID_PATTERN = /^audit_[a-z0-9-]{8,96}$/;
export const LINGVA_HOSTED_PROJECT_AUDIT_ACTOR_ID_MAX_LENGTH = 160;
export const LINGVA_HOSTED_PROJECT_AUDIT_TARGET_ID_MAX_LENGTH = 160;
export const LINGVA_HOSTED_PROJECT_AUDIT_SUMMARY_MAX_LENGTH = 240;

export type LingvaHostedProjectAction =
  (typeof LINGVA_HOSTED_PROJECT_ACTIONS)[keyof typeof LINGVA_HOSTED_PROJECT_ACTIONS];

export type LingvaHostedProjectTier = (typeof LINGVA_HOSTED_PROJECT_TIERS)[number];
export type LingvaHostedCustomerRole = (typeof LINGVA_HOSTED_CUSTOMER_ROLES)[number];
export type LingvaHostedEnvironmentKind = (typeof LINGVA_HOSTED_ENVIRONMENT_KINDS)[number];
export type LingvaHostedDefaultEnvironment = (typeof LINGVA_HOSTED_PROJECT_DEFAULT_ENVIRONMENTS)[number];
export type LingvaHostedApiKeyScope = (typeof LINGVA_HOSTED_API_KEY_SCOPES)[number];
export type LingvaHostedProjectMemberRole = (typeof LINGVA_HOSTED_PROJECT_MEMBER_ROLES)[number];
export type LingvaHostedProjectMemberStatus = (typeof LINGVA_HOSTED_PROJECT_MEMBER_STATUSES)[number];
export type LingvaHostedProjectInviteStatus = (typeof LINGVA_HOSTED_PROJECT_INVITE_STATUSES)[number];
export type LingvaHostedProjectApiKeyStatus = (typeof LINGVA_HOSTED_PROJECT_API_KEY_STATUSES)[number];
export type LingvaHostedProjectAuditAction = (typeof LINGVA_HOSTED_PROJECT_AUDIT_ACTIONS)[number];
export type LingvaHostedProjectAuditTargetType = (typeof LINGVA_HOSTED_PROJECT_AUDIT_TARGET_TYPES)[number];

export interface LingvaHostedProjectEnvironment {
  createdAt?: string;
  deliveryMode: (typeof LINGVA_RUNTIME_MODES)[keyof typeof LINGVA_RUNTIME_MODES];
  environmentId: string;
  kind: LingvaHostedEnvironmentKind;
  name: string;
  projectId: string;
  publishApiUrl?: string;
  updatedAt?: string;
}

export interface LingvaHostedProjectInvite {
  acceptedAt?: string;
  acceptedBy?: string;
  createdAt?: string;
  createdBy: string;
  email?: string;
  expiresAt?: string;
  inviteId: string;
  note?: string;
  projectId: string;
  role: string;
  status: LingvaHostedProjectInviteStatus;
  tokenPreview?: string;
  updatedAt?: string;
}

export interface LingvaHostedProjectApiKey {
  apiKeyId: string;
  createdAt?: string;
  createdBy: string;
  lastUsedAt?: string;
  name: string;
  projectId: string;
  scopes: LingvaHostedApiKeyScope[];
  status: LingvaHostedProjectApiKeyStatus;
  tokenPreview?: string;
  updatedAt?: string;
}

export interface LingvaHostedProjectMember {
  createdAt?: string;
  createdBy?: string;
  email?: string;
  memberId?: string;
  projectId: string;
  role: LingvaHostedProjectMemberRole;
  status: LingvaHostedProjectMemberStatus;
  updatedAt?: string;
  updatedBy?: string;
  userId: string;
}

export interface LingvaHostedProjectAuditEvent {
  action: LingvaHostedProjectAuditAction;
  actorId: string;
  auditId: string;
  createdAt?: string;
  projectId: string;
  summary?: string;
  targetId?: string;
  targetType?: LingvaHostedProjectAuditTargetType;
}

export interface LingvaHostedProjectRecord {
  /** Present after explicit organization migration; legacy records omit it. */
  organizationId?: string;
  createdAt?: string;
  defaultLocale: string;
  description?: string;
  environments: LingvaHostedProjectEnvironment[];
  locales: string[];
  name: string;
  ownerId: string;
  projectId: string;
  tier: LingvaHostedProjectTier;
  updatedAt?: string;
}

export interface LingvaHostedProjectCreateInput {
  defaultLocale?: string;
  description?: string;
  environments?: readonly Partial<LingvaHostedProjectEnvironment>[];
  locales?: readonly string[];
  name: string;
  ownerId: string;
  projectId: string;
  tier?: LingvaHostedProjectTier;
}

export interface LingvaHostedProjectDeleteInput {
  ownerId: string;
  projectId: string;
}

export interface LingvaHostedProjectUpdateInput {
  /** Omit to preserve the current display name. Project ID never changes. */
  name?: string;
  defaultLocale: string;
  locales: readonly string[];
  projectId: string;
}

export interface LingvaHostedProjectAdminUpdateInput {
  defaultLocale: string;
  description?: string;
  locales: readonly string[];
  name: string;
  projectId: string;
  tier: LingvaHostedProjectTier;
}

export interface LingvaHostedCustomerUpdateInput {
  enabled: boolean;
  planTier: LingvaHostedProjectTier;
  role: LingvaHostedCustomerRole;
  username: string;
}

export interface LingvaHostedEnvironmentUpsertInput {
  deliveryMode?: LingvaRuntimeMode;
  environmentId: string;
  kind?: LingvaHostedEnvironmentKind;
  name?: string;
  projectId: string;
  publishApiUrl?: string;
}

export interface LingvaHostedInviteCreateInput {
  createdBy: string;
  email?: string;
  expiresInDays?: number;
  note?: string;
  projectId: string;
  role: string;
  sendEmail?: boolean;
}

export interface LingvaHostedInviteRevokeInput {
  inviteId: string;
  projectId: string;
}

export interface LingvaHostedInviteAcceptInput {
  acceptedBy?: string;
  projectId: string;
  token: string;
  userEmail?: string;
  userId: string;
}

export interface LingvaHostedApiKeyCreateInput {
  createdBy: string;
  name: string;
  projectId: string;
  scopes?: readonly LingvaHostedApiKeyScope[];
}

export interface LingvaHostedApiKeyRevokeInput {
  apiKeyId: string;
  projectId: string;
}

export interface LingvaHostedProjectMemberUpsertInput {
  createdBy?: string;
  projectId: string;
  role: LingvaHostedProjectMemberRole;
  updatedBy?: string;
  userId: string;
}

export interface LingvaHostedProjectMemberRevokeInput {
  projectId: string;
  updatedBy?: string;
  userId: string;
}

export interface LingvaHostedProjectAuditEventCreateInput {
  action: LingvaHostedProjectAuditAction;
  actorId: string;
  auditId: string;
  createdAt?: string;
  projectId: string;
  summary?: string;
  targetId?: string;
  targetType?: LingvaHostedProjectAuditTargetType;
}

export interface LingvaHostedProjectAuditListInput {
  limit?: number;
  nextToken?: string;
  projectId: string;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeBoundedOptionalString(
  value: string | undefined,
  fieldName: string,
  maxLength: number
): string | undefined {
  const normalized = normalizeOptionalString(value);

  if (normalized && normalized.length > maxLength) {
    throw new Error(`Lingva hosted project ${fieldName} is too long.`);
  }

  return normalized;
}

function normalizeRequiredString(value: string, fieldName: string): string {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    throw new Error(`Lingva hosted project ${fieldName} is required.`);
  }

  return normalized;
}

function normalizeMemberUserId(value: string): string {
  const normalized = normalizeRequiredString(value, 'member userId');

  if (normalized.length > LINGVA_HOSTED_PROJECT_MEMBER_USER_ID_MAX_LENGTH) {
    throw new Error('Lingva hosted project member userId is too long.');
  }

  return normalized;
}

function normalizeAuditActorId(value: string): string {
  const normalized = normalizeRequiredString(value, 'audit actorId');

  if (normalized.length > LINGVA_HOSTED_PROJECT_AUDIT_ACTOR_ID_MAX_LENGTH) {
    throw new Error('Lingva hosted project audit actorId is too long.');
  }

  return normalized;
}

function normalizeAuditTargetId(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalString(value);

  if (normalized && normalized.length > LINGVA_HOSTED_PROJECT_AUDIT_TARGET_ID_MAX_LENGTH) {
    throw new Error('Lingva hosted project audit targetId is too long.');
  }

  return normalized;
}

function normalizeIdentifier(value: string, fieldName: string, pattern: RegExp): string {
  const normalized = normalizeRequiredString(value, fieldName).toLowerCase();

  if (!pattern.test(normalized)) {
    throw new Error(`Lingva hosted project ${fieldName} has an invalid format.`);
  }

  return normalized;
}

function normalizeAuditId(value: string): string {
  const normalized = normalizeRequiredString(value, 'auditId').toLowerCase();

  if (!LINGVA_HOSTED_PROJECT_AUDIT_ID_PATTERN.test(normalized)) {
    throw new Error('Lingva hosted project auditId has an invalid format.');
  }

  return normalized;
}

function normalizeInviteId(value: string): string {
  const normalized = normalizeRequiredString(value, 'inviteId').toLowerCase();

  if (!LINGVA_HOSTED_INVITE_ID_PATTERN.test(normalized)) {
    throw new Error('Lingva hosted project inviteId has an invalid format.');
  }

  return normalized;
}

function normalizeInviteToken(value: string): string {
  const normalized = normalizeRequiredString(value, 'invite token');

  if (normalized.length > LINGVA_HOSTED_INVITE_TOKEN_MAX_LENGTH) {
    throw new Error('Lingva hosted project invite token is too long.');
  }

  return normalized;
}

function normalizeApiKeyId(value: string): string {
  const normalized = normalizeRequiredString(value, 'apiKeyId').toLowerCase();

  if (!LINGVA_HOSTED_API_KEY_ID_PATTERN.test(normalized)) {
    throw new Error('Lingva hosted project apiKeyId has an invalid format.');
  }

  return normalized;
}

function normalizeApiKeyScopes(scopes: readonly LingvaHostedApiKeyScope[] | undefined): LingvaHostedApiKeyScope[] {
  const normalized = Array.from(
    new Set(
      (scopes?.length ? scopes : ['delivery:read']).filter((scope): scope is LingvaHostedApiKeyScope =>
        LINGVA_HOSTED_API_KEY_SCOPES.includes(scope as LingvaHostedApiKeyScope)
      )
    )
  );

  if (normalized.length === 0) {
    throw new Error('Lingva hosted project api key scopes are required.');
  }

  return normalized;
}

function normalizeLocaleCode(value: string, fieldName = 'locale'): string {
  const normalized = normalizeRequiredString(value, fieldName).toLowerCase();

  if (normalized.length > LINGVA_HOSTED_LOCALE_MAX_LENGTH) {
    throw new Error(`Lingva hosted project ${fieldName} is too long.`);
  }

  if (!LINGVA_HOSTED_LOCALE_PATTERN.test(normalized)) {
    throw new Error(`Lingva hosted project ${fieldName} has an invalid format.`);
  }

  return normalized;
}

function normalizeLocaleList(locales: readonly string[] | undefined, defaultLocale: string): string[] {
  const normalized = Array.from(
    new Set(
      (locales?.length ? locales : [defaultLocale])
        .map((locale) => normalizeLocaleCode(locale, 'locale'))
        .filter(Boolean)
    )
  );

  return [defaultLocale, ...normalized.filter((locale) => locale !== defaultLocale)];
}

function normalizeProjectTier(value: LingvaHostedProjectTier | undefined): LingvaHostedProjectTier {
  return value && isLingvaHostedProjectTier(value) ? value : LINGVA_HOSTED_PROJECT_TIER.free;
}

function normalizeEnvironmentKind(
  value: LingvaHostedEnvironmentKind | undefined,
  environmentId: string
): LingvaHostedEnvironmentKind {
  if (value && isLingvaHostedEnvironmentKind(value)) {
    return value;
  }

  if (environmentId === LINGVA_DEPLOYMENT_STAGES.production) {
    return LINGVA_HOSTED_ENVIRONMENT_KIND.production;
  }

  if (environmentId === LINGVA_DEPLOYMENT_STAGES.staging) {
    return LINGVA_HOSTED_ENVIRONMENT_KIND.staging;
  }

  if (environmentId === LINGVA_DEPLOYMENT_STAGES.development) {
    return LINGVA_HOSTED_ENVIRONMENT_KIND.development;
  }

  return LINGVA_HOSTED_ENVIRONMENT_KIND.custom;
}

function createDefaultEnvironmentInput(
  projectId: string,
  environmentId: LingvaHostedDefaultEnvironment
): LingvaHostedEnvironmentUpsertInput {
  return {
    projectId,
    environmentId,
    deliveryMode:
      environmentId === LINGVA_DEPLOYMENT_STAGES.development ? LINGVA_RUNTIME_MODES.local : LINGVA_RUNTIME_MODES.remote,
    kind: normalizeEnvironmentKind(undefined, environmentId),
    name: environmentId,
  };
}

export function isLingvaHostedProjectAction(value: unknown): value is LingvaHostedProjectAction {
  return Object.values(LINGVA_HOSTED_PROJECT_ACTIONS).includes(value as LingvaHostedProjectAction);
}

export function isLingvaHostedProjectTier(value: unknown): value is LingvaHostedProjectTier {
  return LINGVA_HOSTED_PROJECT_TIERS.includes(value as LingvaHostedProjectTier);
}

export function isLingvaHostedCustomerRole(value: unknown): value is LingvaHostedCustomerRole {
  return LINGVA_HOSTED_CUSTOMER_ROLES.includes(value as LingvaHostedCustomerRole);
}

export function isLingvaHostedEnvironmentKind(value: unknown): value is LingvaHostedEnvironmentKind {
  return LINGVA_HOSTED_ENVIRONMENT_KINDS.includes(value as LingvaHostedEnvironmentKind);
}

export function isLingvaHostedProjectMemberRole(value: unknown): value is LingvaHostedProjectMemberRole {
  return LINGVA_HOSTED_PROJECT_MEMBER_ROLES.includes(value as LingvaHostedProjectMemberRole);
}

export function isLingvaHostedProjectMemberStatus(value: unknown): value is LingvaHostedProjectMemberStatus {
  return LINGVA_HOSTED_PROJECT_MEMBER_STATUSES.includes(value as LingvaHostedProjectMemberStatus);
}

export function isLingvaHostedProjectAuditAction(value: unknown): value is LingvaHostedProjectAuditAction {
  return LINGVA_HOSTED_PROJECT_AUDIT_ACTIONS.includes(value as LingvaHostedProjectAuditAction);
}

export function isLingvaHostedProjectAuditTargetType(value: unknown): value is LingvaHostedProjectAuditTargetType {
  return LINGVA_HOSTED_PROJECT_AUDIT_TARGET_TYPES.includes(value as LingvaHostedProjectAuditTargetType);
}

export function normalizeLingvaHostedEnvironment(
  input: LingvaHostedEnvironmentUpsertInput
): LingvaHostedProjectEnvironment {
  const projectId = normalizeIdentifier(input.projectId, 'projectId', LINGVA_HOSTED_PROJECT_ID_PATTERN);
  const environmentId = normalizeIdentifier(input.environmentId, 'environmentId', LINGVA_HOSTED_ENVIRONMENT_ID_PATTERN);
  const deliveryMode =
    input.deliveryMode === LINGVA_RUNTIME_MODES.local ? LINGVA_RUNTIME_MODES.local : LINGVA_RUNTIME_MODES.remote;

  return {
    projectId,
    environmentId,
    deliveryMode,
    kind: normalizeEnvironmentKind(input.kind, environmentId),
    name: normalizeOptionalString(input.name) ?? environmentId,
    publishApiUrl: normalizeOptionalString(input.publishApiUrl),
  };
}

export function normalizeLingvaHostedInviteCreateInput(
  input: LingvaHostedInviteCreateInput
): LingvaHostedInviteCreateInput {
  const projectId = normalizeIdentifier(input.projectId, 'projectId', LINGVA_HOSTED_PROJECT_ID_PATTERN);
  const createdBy = normalizeRequiredString(input.createdBy, 'createdBy');
  const role = normalizeRequiredString(input.role, 'role');

  if (role === LINGVA_HOSTED_PROJECT_MEMBER_ROLE.owner) {
    throw new Error('Lingva hosted project ownership cannot be assigned through an invite.');
  }

  if (role.length > LINGVA_HOSTED_INVITE_ROLE_MAX_LENGTH) {
    throw new Error('Lingva hosted project invite role is too long.');
  }

  if (
    input.expiresInDays !== undefined &&
    (!Number.isInteger(input.expiresInDays) || input.expiresInDays < 1 || input.expiresInDays > 366)
  ) {
    throw new Error('Lingva hosted project invite expiry must be an integer between 1 and 366 days.');
  }

  return {
    projectId,
    createdBy,
    role,
    email: normalizeBoundedOptionalString(
      input.email,
      'invite email',
      LINGVA_HOSTED_INVITE_EMAIL_MAX_LENGTH
    )?.toLowerCase(),
    expiresInDays: input.expiresInDays,
    note: normalizeBoundedOptionalString(input.note, 'invite note', LINGVA_HOSTED_INVITE_NOTE_MAX_LENGTH),
    ...(input.sendEmail === true ? { sendEmail: true } : {}),
  };
}

export function normalizeLingvaHostedInviteRevokeInput(
  input: LingvaHostedInviteRevokeInput
): LingvaHostedInviteRevokeInput {
  return {
    projectId: normalizeIdentifier(input.projectId, 'projectId', LINGVA_HOSTED_PROJECT_ID_PATTERN),
    inviteId: normalizeInviteId(input.inviteId),
  };
}

export function normalizeLingvaHostedInviteAcceptInput(
  input: LingvaHostedInviteAcceptInput
): LingvaHostedInviteAcceptInput {
  return {
    acceptedBy: normalizeOptionalString(input.acceptedBy),
    projectId: normalizeIdentifier(input.projectId, 'projectId', LINGVA_HOSTED_PROJECT_ID_PATTERN),
    token: normalizeInviteToken(input.token),
    userEmail: normalizeOptionalString(input.userEmail)?.toLowerCase(),
    userId: normalizeMemberUserId(input.userId),
  };
}

export function normalizeLingvaHostedApiKeyCreateInput(
  input: LingvaHostedApiKeyCreateInput
): LingvaHostedApiKeyCreateInput {
  const projectId = normalizeIdentifier(input.projectId, 'projectId', LINGVA_HOSTED_PROJECT_ID_PATTERN);
  const createdBy = normalizeRequiredString(input.createdBy, 'createdBy');
  const name = normalizeRequiredString(input.name, 'api key name');

  if (name.length > LINGVA_HOSTED_API_KEY_NAME_MAX_LENGTH) {
    throw new Error('Lingva hosted project api key name is too long.');
  }

  return {
    projectId,
    createdBy,
    name,
    scopes: normalizeApiKeyScopes(input.scopes),
  };
}

export function normalizeLingvaHostedApiKeyRevokeInput(
  input: LingvaHostedApiKeyRevokeInput
): LingvaHostedApiKeyRevokeInput {
  return {
    projectId: normalizeIdentifier(input.projectId, 'projectId', LINGVA_HOSTED_PROJECT_ID_PATTERN),
    apiKeyId: normalizeApiKeyId(input.apiKeyId),
  };
}

export function normalizeLingvaHostedProjectMemberUpsertInput(
  input: LingvaHostedProjectMemberUpsertInput
): LingvaHostedProjectMemberUpsertInput {
  const role = input.role;

  if (!LINGVA_HOSTED_ASSIGNABLE_PROJECT_MEMBER_ROLES.some((candidate) => candidate === role)) {
    throw new Error('Lingva hosted project member role must be admin, editor, or viewer.');
  }

  return {
    projectId: normalizeIdentifier(input.projectId, 'projectId', LINGVA_HOSTED_PROJECT_ID_PATTERN),
    userId: normalizeMemberUserId(input.userId),
    role,
    createdBy: normalizeOptionalString(input.createdBy),
    updatedBy: normalizeOptionalString(input.updatedBy),
  };
}

export function normalizeLingvaHostedProjectMemberRevokeInput(
  input: LingvaHostedProjectMemberRevokeInput
): LingvaHostedProjectMemberRevokeInput {
  return {
    projectId: normalizeIdentifier(input.projectId, 'projectId', LINGVA_HOSTED_PROJECT_ID_PATTERN),
    userId: normalizeMemberUserId(input.userId),
    updatedBy: normalizeOptionalString(input.updatedBy),
  };
}

export function normalizeLingvaHostedProjectAuditEvent(
  input: LingvaHostedProjectAuditEventCreateInput
): LingvaHostedProjectAuditEvent {
  if (!isLingvaHostedProjectAuditAction(input.action)) {
    throw new Error('Lingva hosted project audit action is invalid.');
  }

  if (input.targetType && !isLingvaHostedProjectAuditTargetType(input.targetType)) {
    throw new Error('Lingva hosted project audit targetType is invalid.');
  }

  return {
    action: input.action,
    actorId: normalizeAuditActorId(input.actorId),
    auditId: normalizeAuditId(input.auditId),
    createdAt: normalizeOptionalString(input.createdAt),
    projectId: normalizeIdentifier(input.projectId, 'projectId', LINGVA_HOSTED_PROJECT_ID_PATTERN),
    summary: normalizeBoundedOptionalString(
      input.summary,
      'audit summary',
      LINGVA_HOSTED_PROJECT_AUDIT_SUMMARY_MAX_LENGTH
    ),
    targetId: normalizeAuditTargetId(input.targetId),
    targetType: input.targetType,
  };
}

export function normalizeLingvaHostedProjectAuditListInput(
  input: LingvaHostedProjectAuditListInput
): LingvaHostedProjectAuditListInput {
  return {
    limit: input.limit,
    nextToken: normalizeOptionalString(input.nextToken),
    projectId: normalizeIdentifier(input.projectId, 'projectId', LINGVA_HOSTED_PROJECT_ID_PATTERN),
  };
}

type LingvaHostedProjectDetails = Pick<
  LingvaHostedProjectRecord,
  'defaultLocale' | 'description' | 'locales' | 'name' | 'projectId' | 'tier'
>;

function normalizeLingvaHostedProjectDetails(
  input: LingvaHostedProjectCreateInput | LingvaHostedProjectAdminUpdateInput
): LingvaHostedProjectDetails {
  const projectId = normalizeIdentifier(input.projectId, 'projectId', LINGVA_HOSTED_PROJECT_ID_PATTERN);
  const name = normalizeRequiredString(input.name, 'name');
  const defaultLocale = normalizeLocaleCode(input.defaultLocale ?? 'en', 'defaultLocale');
  const description = normalizeOptionalString(input.description);

  if (name.length > LINGVA_HOSTED_PROJECT_NAME_MAX_LENGTH) {
    throw new Error('Lingva hosted project name is too long.');
  }

  if (description && description.length > LINGVA_HOSTED_PROJECT_DESCRIPTION_MAX_LENGTH) {
    throw new Error('Lingva hosted project description is too long.');
  }

  return {
    defaultLocale,
    description,
    locales: normalizeLocaleList(input.locales, defaultLocale),
    name,
    projectId,
    tier: normalizeProjectTier(input.tier),
  };
}

export function createLingvaHostedProjectRecord(input: LingvaHostedProjectCreateInput): LingvaHostedProjectRecord {
  const details = normalizeLingvaHostedProjectDetails(input);
  const ownerId = normalizeRequiredString(input.ownerId, 'ownerId');

  const explicitEnvironments =
    input.environments?.map((environment) =>
      normalizeLingvaHostedEnvironment({
        projectId: details.projectId,
        environmentId: environment.environmentId ?? '',
        deliveryMode: environment.deliveryMode,
        kind: environment.kind,
        name: environment.name,
        publishApiUrl: environment.publishApiUrl,
      })
    ) ?? [];
  const environments =
    explicitEnvironments.length > 0
      ? explicitEnvironments
      : LINGVA_HOSTED_PROJECT_DEFAULT_ENVIRONMENTS.map((environmentId) =>
          normalizeLingvaHostedEnvironment(createDefaultEnvironmentInput(details.projectId, environmentId))
        );

  return {
    ...details,
    ownerId,
    environments,
  };
}

export function createLingvaHostedProjectPayload(
  input: LingvaHostedProjectCreateInput
): LingvaHostedProjectCreateInput & {
  action: typeof LINGVA_HOSTED_PROJECT_ACTIONS.createProject;
} {
  const record = createLingvaHostedProjectRecord(input);

  return {
    action: LINGVA_HOSTED_PROJECT_ACTIONS.createProject,
    projectId: record.projectId,
    ownerId: record.ownerId,
    name: record.name,
    defaultLocale: record.defaultLocale,
    description: record.description,
    locales: record.locales,
    tier: record.tier,
    environments: record.environments,
  };
}

export function createLingvaHostedProjectDeletePayload(
  input: LingvaHostedProjectDeleteInput
): LingvaHostedProjectDeleteInput & {
  action: typeof LINGVA_HOSTED_PROJECT_ACTIONS.deleteProject;
} {
  return {
    action: LINGVA_HOSTED_PROJECT_ACTIONS.deleteProject,
    ownerId: normalizeRequiredString(input.ownerId, 'ownerId'),
    projectId: normalizeIdentifier(input.projectId, 'projectId', LINGVA_HOSTED_PROJECT_ID_PATTERN),
  };
}

export function createLingvaHostedProjectAdminUpdatePayload(input: LingvaHostedProjectAdminUpdateInput): {
  action: typeof LINGVA_HOSTED_PROJECT_ACTIONS.adminUpdateProject;
  project: LingvaHostedProjectAdminUpdateInput;
} {
  const project = normalizeLingvaHostedProjectDetails(input);

  return {
    action: LINGVA_HOSTED_PROJECT_ACTIONS.adminUpdateProject,
    project,
  };
}

export function createLingvaHostedCustomerUpdatePayload(input: LingvaHostedCustomerUpdateInput): {
  action: typeof LINGVA_HOSTED_PROJECT_ACTIONS.updateCustomer;
  customer: LingvaHostedCustomerUpdateInput;
} {
  if (!isLingvaHostedProjectTier(input.planTier)) {
    throw new Error('Lingva hosted customer planTier is invalid.');
  }
  if (!isLingvaHostedCustomerRole(input.role)) {
    throw new Error('Lingva hosted customer role is invalid.');
  }

  return {
    action: LINGVA_HOSTED_PROJECT_ACTIONS.updateCustomer,
    customer: {
      enabled: input.enabled,
      planTier: input.planTier,
      role: input.role,
      username: normalizeRequiredString(input.username, 'username'),
    },
  };
}

export function createLingvaHostedProjectMemberPayload(
  input: LingvaHostedProjectMemberUpsertInput
): LingvaHostedProjectMemberUpsertInput & {
  action: typeof LINGVA_HOSTED_PROJECT_ACTIONS.upsertMember;
} {
  return {
    action: LINGVA_HOSTED_PROJECT_ACTIONS.upsertMember,
    ...normalizeLingvaHostedProjectMemberUpsertInput(input),
  };
}

export function createLingvaHostedProjectMemberRevokePayload(
  input: LingvaHostedProjectMemberRevokeInput
): LingvaHostedProjectMemberRevokeInput & {
  action: typeof LINGVA_HOSTED_PROJECT_ACTIONS.revokeMember;
} {
  return {
    action: LINGVA_HOSTED_PROJECT_ACTIONS.revokeMember,
    ...normalizeLingvaHostedProjectMemberRevokeInput(input),
  };
}

export function createLingvaHostedProjectAuditEventPayload(input: LingvaHostedProjectAuditEventCreateInput): {
  action: typeof LINGVA_HOSTED_PROJECT_ACTIONS.createAuditEvent;
  auditEvent: LingvaHostedProjectAuditEvent;
} {
  const event = normalizeLingvaHostedProjectAuditEvent(input);

  return {
    action: LINGVA_HOSTED_PROJECT_ACTIONS.createAuditEvent,
    auditEvent: event,
  };
}

export function createLingvaHostedEnvironmentPayload(
  input: LingvaHostedEnvironmentUpsertInput
): LingvaHostedProjectEnvironment & {
  action: typeof LINGVA_HOSTED_PROJECT_ACTIONS.upsertEnvironment;
} {
  return {
    action: LINGVA_HOSTED_PROJECT_ACTIONS.upsertEnvironment,
    ...normalizeLingvaHostedEnvironment(input),
  };
}

export function createLingvaHostedInvitePayload(input: LingvaHostedInviteCreateInput): LingvaHostedInviteCreateInput & {
  action: typeof LINGVA_HOSTED_PROJECT_ACTIONS.createInvite;
} {
  return {
    action: LINGVA_HOSTED_PROJECT_ACTIONS.createInvite,
    ...normalizeLingvaHostedInviteCreateInput(input),
  };
}

export function createLingvaHostedInviteRevokePayload(
  input: LingvaHostedInviteRevokeInput
): LingvaHostedInviteRevokeInput & {
  action: typeof LINGVA_HOSTED_PROJECT_ACTIONS.revokeInvite;
} {
  return {
    action: LINGVA_HOSTED_PROJECT_ACTIONS.revokeInvite,
    ...normalizeLingvaHostedInviteRevokeInput(input),
  };
}

export function createLingvaHostedInviteAcceptPayload(
  input: LingvaHostedInviteAcceptInput
): LingvaHostedInviteAcceptInput & {
  action: typeof LINGVA_HOSTED_PROJECT_ACTIONS.acceptInvite;
} {
  return {
    action: LINGVA_HOSTED_PROJECT_ACTIONS.acceptInvite,
    ...normalizeLingvaHostedInviteAcceptInput(input),
  };
}

export function createLingvaHostedApiKeyPayload(input: LingvaHostedApiKeyCreateInput): LingvaHostedApiKeyCreateInput & {
  action: typeof LINGVA_HOSTED_PROJECT_ACTIONS.createApiKey;
} {
  return {
    action: LINGVA_HOSTED_PROJECT_ACTIONS.createApiKey,
    ...normalizeLingvaHostedApiKeyCreateInput(input),
  };
}

export function createLingvaHostedApiKeyRevokePayload(
  input: LingvaHostedApiKeyRevokeInput
): LingvaHostedApiKeyRevokeInput & {
  action: typeof LINGVA_HOSTED_PROJECT_ACTIONS.revokeApiKey;
} {
  return {
    action: LINGVA_HOSTED_PROJECT_ACTIONS.revokeApiKey,
    ...normalizeLingvaHostedApiKeyRevokeInput(input),
  };
}

export function normalizeLingvaHostedProjectUpdateInput(
  input: LingvaHostedProjectUpdateInput
): LingvaHostedProjectUpdateInput {
  const projectId = normalizeIdentifier(input.projectId, 'projectId', LINGVA_HOSTED_PROJECT_ID_PATTERN);
  const defaultLocale = normalizeLocaleCode(input.defaultLocale, 'defaultLocale');
  const name = input.name === undefined ? undefined : normalizeRequiredString(input.name, 'name');
  if (name !== undefined && name.length > LINGVA_HOSTED_PROJECT_NAME_MAX_LENGTH) {
    throw new Error('Lingva hosted project name is too long.');
  }

  if (!Array.isArray(input.locales) || input.locales.length === 0) {
    throw new Error('Lingva hosted project locales must include at least one entry.');
  }

  const seen = new Set<string>();
  const locales: string[] = [];

  for (const raw of input.locales) {
    const normalized = normalizeLocaleCode(raw, 'locale');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      locales.push(normalized);
    }
  }

  if (!seen.has(defaultLocale)) {
    throw new Error('Lingva hosted project defaultLocale must be present in the locales list.');
  }

  return {
    ...(name === undefined ? {} : { name }),
    projectId,
    defaultLocale,
    locales: [defaultLocale, ...locales.filter((locale) => locale !== defaultLocale)],
  };
}

export function createLingvaHostedProjectUpdatePayload(
  input: LingvaHostedProjectUpdateInput
): LingvaHostedProjectUpdateInput & {
  action: typeof LINGVA_HOSTED_PROJECT_ACTIONS.updateProject;
} {
  return {
    action: LINGVA_HOSTED_PROJECT_ACTIONS.updateProject,
    ...normalizeLingvaHostedProjectUpdateInput(input),
  };
}
