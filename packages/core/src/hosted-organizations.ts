import {
  LINGVA_HOSTED_INVITE_EMAIL_MAX_LENGTH,
  LINGVA_HOSTED_INVITE_TOKEN_MAX_LENGTH,
  LINGVA_HOSTED_PROJECT_ID_PATTERN,
  LINGVA_HOSTED_PROJECT_MEMBER_ROLE,
  type LingvaHostedProjectMemberRole,
  type LingvaHostedProjectTier,
} from './hosted-projects';

/** Portable organization contracts. Hosted authorization and commercial policy stay server-side. */
export const LINGVA_HOSTED_ORGANIZATION_ACTIONS = {
  overview: 'getOrganization',
  audit: 'listOrganizationAuditEvents',
  deleteProject: 'deleteOrganizationProject',
  getSecurity: 'getOrganizationSecurity',
  configureOidc: 'configureOrganizationOidc',
  startSso: 'startOrganizationSso',
  completeSso: 'completeOrganizationSso',
  setSsoMode: 'setOrganizationSsoMode',
  createSsoRecovery: 'createOrganizationSsoRecovery',
  testSsoRecovery: 'testOrganizationSsoRecovery',
  recoverSso: 'recoverOrganizationSso',
  requestCliSso: 'requestOrganizationCliSso',
  startCliSso: 'startOrganizationCliSso',
  ssoStatus: 'getOrganizationSsoStatus',
  update: 'updateOrganization',
  members: 'listOrganizationMembers',
  updateMember: 'updateOrganizationMember',
  removeMember: 'removeOrganizationMember',
  leave: 'leaveOrganization',
  transfer: 'transferOrganizationOwnership',
  groups: 'listOrganizationGroups',
  saveGroup: 'saveOrganizationGroup',
  removeGroup: 'removeOrganizationGroup',
  projectAccess: 'getOrganizationProjectAccess',
  saveGrant: 'saveOrganizationProjectGrant',
  removeGrant: 'removeOrganizationProjectGrant',
  createProject: 'createOrganizationProject',
  projects: 'listOrganizationProjects',
  acceptInvite: 'acceptOrganizationInvite',
  create: 'createOrganization',
  createInvite: 'createOrganizationInvite',
  list: 'listOrganizations',
  listInvites: 'listOrganizationInvites',
  revokeInvite: 'revokeOrganizationInvite',
  resendInvite: 'resendOrganizationInvite',
} as const;

export const LINGVA_HOSTED_ORGANIZATION_ROLE = {
  owner: 'owner',
  admin: 'admin',
  member: 'member',
  guest: 'guest',
} as const;

export const LINGVA_HOSTED_ORGANIZATION_MEMBER_STATUS = {
  active: 'active',
  revoked: 'revoked',
} as const;

export const LINGVA_HOSTED_ORGANIZATION_INVITE_STATUS = {
  active: 'active',
  accepted: 'accepted',
  revoked: 'revoked',
  expired: 'expired',
} as const;

export const LINGVA_HOSTED_ORGANIZATION_SSO_MODE = {
  disabled: 'disabled',
  optional: 'optional',
  required: 'required',
} as const;

export const LINGVA_HOSTED_ORGANIZATION_REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const LINGVA_HOSTED_ORGANIZATION_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,63}$/;
export const LINGVA_HOSTED_ORGANIZATION_INVITE_ID_PATTERN = /^invite_[a-z0-9-]{8,57}$/;
export const LINGVA_HOSTED_ORGANIZATION_NAME_MAX_LENGTH = 80;
export const LINGVA_HOSTED_ORGANIZATION_INVITE_DEFAULT_DAYS = 14;
export const LINGVA_HOSTED_ORGANIZATION_INVITE_MAX_DAYS = 30;
export const LINGVA_HOSTED_ORGANIZATION_INVITE_MAX_ASSIGNMENTS = 90;

export type LingvaHostedOrganizationRole =
  (typeof LINGVA_HOSTED_ORGANIZATION_ROLE)[keyof typeof LINGVA_HOSTED_ORGANIZATION_ROLE];
export type LingvaHostedOrganizationInviteRole = Exclude<LingvaHostedOrganizationRole, 'owner'>;
export type LingvaHostedOrganizationProjectRole = Exclude<LingvaHostedProjectMemberRole, 'owner'>;
export type LingvaHostedOrganizationSsoMode =
  (typeof LINGVA_HOSTED_ORGANIZATION_SSO_MODE)[keyof typeof LINGVA_HOSTED_ORGANIZATION_SSO_MODE];

/** Identity is independent of membership; an account may have no organization records. */
export interface LingvaHostedOrganizationRecord {
  organizationId: string;
  name: string;
  tier: LingvaHostedProjectTier;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface LingvaHostedOrganizationMembership {
  organizationId: string;
  userId: string;
  role: LingvaHostedOrganizationRole;
  status: (typeof LINGVA_HOSTED_ORGANIZATION_MEMBER_STATUS)[keyof typeof LINGVA_HOSTED_ORGANIZATION_MEMBER_STATUS];
  createdAt: string;
  updatedAt: string;
}

export interface LingvaHostedOrganizationProjectGrant {
  projectId: string;
  role: LingvaHostedOrganizationProjectRole;
}

/** Public invitation view excludes token hashes and authentication subjects. Expiry is checked by the server. */
export interface LingvaHostedOrganizationInvite {
  organizationId: string;
  inviteId: string;
  email: string;
  role: LingvaHostedOrganizationInviteRole;
  groupIds: string[];
  projectGrants: LingvaHostedOrganizationProjectGrant[];
  status: (typeof LINGVA_HOSTED_ORGANIZATION_INVITE_STATUS)[keyof typeof LINGVA_HOSTED_ORGANIZATION_INVITE_STATUS];
  createdAt: string;
  expiresAt: string;
}

export interface LingvaHostedOrganizationInviteCreateInput {
  organizationId: string;
  email: string;
  role?: LingvaHostedOrganizationInviteRole;
  groupIds?: readonly string[];
  projectGrants?: readonly LingvaHostedOrganizationProjectGrant[];
  expiresInDays?: number;
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`Lingva organization ${field} is invalid.`);
  }
  return value.trim();
}

function identifier(value: unknown, field: string, pattern = LINGVA_HOSTED_ORGANIZATION_ID_PATTERN): string {
  const result = requiredString(value, field, 64);
  if (!pattern.test(result)) throw new Error(`Lingva organization ${field} is invalid.`);
  return result;
}

/** The server derives identity and Free tier. Reuse requestId when retrying the same creation. */
export function createLingvaHostedOrganizationPayload(input: { name: string; requestId: string }) {
  if (typeof input.requestId !== 'string' || !LINGVA_HOSTED_ORGANIZATION_REQUEST_ID_PATTERN.test(input.requestId)) {
    throw new Error('Lingva organization requestId must be a UUID v4.');
  }
  return {
    requestId: input.requestId.toLowerCase(),
    action: LINGVA_HOSTED_ORGANIZATION_ACTIONS.create,
    name: requiredString(input.name, 'name', LINGVA_HOSTED_ORGANIZATION_NAME_MAX_LENGTH),
  };
}

/** Validation does not replace server checks of actor permissions, assignment scope, quotas, or invite state. */
export function createLingvaHostedOrganizationInvitePayload(input: LingvaHostedOrganizationInviteCreateInput) {
  const organizationId = identifier(input.organizationId, 'organizationId');
  const email = requiredString(input.email, 'invite email', LINGVA_HOSTED_INVITE_EMAIL_MAX_LENGTH).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Lingva organization invite email is invalid.');

  const role = input.role ?? LINGVA_HOSTED_ORGANIZATION_ROLE.member;
  if (
    role !== LINGVA_HOSTED_ORGANIZATION_ROLE.admin &&
    role !== LINGVA_HOSTED_ORGANIZATION_ROLE.member &&
    role !== LINGVA_HOSTED_ORGANIZATION_ROLE.guest
  ) {
    throw new Error('Lingva organization invite role is invalid; ownership requires a dedicated transfer.');
  }

  const expiresInDays = input.expiresInDays ?? LINGVA_HOSTED_ORGANIZATION_INVITE_DEFAULT_DAYS;
  if (
    !Number.isInteger(expiresInDays) ||
    expiresInDays < 1 ||
    expiresInDays > LINGVA_HOSTED_ORGANIZATION_INVITE_MAX_DAYS
  ) {
    throw new Error('Lingva organization invite expiry must be an integer between 1 and 30 days.');
  }

  const groups = input.groupIds ?? [];
  const grants = input.projectGrants ?? [];
  if (
    !Array.isArray(groups) ||
    !Array.isArray(grants) ||
    groups.length + grants.length > LINGVA_HOSTED_ORGANIZATION_INVITE_MAX_ASSIGNMENTS
  ) {
    throw new Error('Lingva organization invite assignments are invalid or exceed the request limit.');
  }
  const groupIds = [...new Set(groups.map((groupId) => identifier(groupId, 'groupId')))];
  const projectGrants = grants.map((grant) => {
    if (
      !grant ||
      ![
        LINGVA_HOSTED_PROJECT_MEMBER_ROLE.admin,
        LINGVA_HOSTED_PROJECT_MEMBER_ROLE.editor,
        LINGVA_HOSTED_PROJECT_MEMBER_ROLE.viewer,
      ].includes(grant.role)
    ) {
      throw new Error('Lingva organization invite project role is invalid.');
    }
    return {
      projectId: identifier(grant.projectId, 'projectId', LINGVA_HOSTED_PROJECT_ID_PATTERN),
      role: grant.role,
    };
  });
  if (new Set(projectGrants.map((grant) => grant.projectId)).size !== projectGrants.length) {
    throw new Error('Lingva organization invite contains duplicate project grants.');
  }
  if (role === LINGVA_HOSTED_ORGANIZATION_ROLE.guest && groupIds.length > 0) {
    throw new Error('Lingva organization guests require direct project grants, not group membership.');
  }

  return {
    action: LINGVA_HOSTED_ORGANIZATION_ACTIONS.createInvite,
    organizationId,
    email,
    role,
    groupIds,
    projectGrants,
    expiresInDays,
  };
}

/** Acceptance sends no identity claim. The server uses the signed session and its verified email. */
export function createLingvaHostedOrganizationInviteAcceptPayload(input: { organizationId: string; token: string }) {
  return {
    action: LINGVA_HOSTED_ORGANIZATION_ACTIONS.acceptInvite,
    organizationId: identifier(input.organizationId, 'organizationId'),
    token: requiredString(input.token, 'invite token', LINGVA_HOSTED_INVITE_TOKEN_MAX_LENGTH),
  };
}

/** Resending rotates the secret while preserving a single invitation reservation. */
export function createLingvaHostedOrganizationInviteResendPayload(input: {
  organizationId: string;
  inviteId: string;
  expiresInDays?: number;
}) {
  const expiresInDays = input.expiresInDays ?? LINGVA_HOSTED_ORGANIZATION_INVITE_DEFAULT_DAYS;
  if (
    !Number.isInteger(expiresInDays) ||
    expiresInDays < 1 ||
    expiresInDays > LINGVA_HOSTED_ORGANIZATION_INVITE_MAX_DAYS
  )
    throw new Error('Lingva organization invite expiry must be an integer between 1 and 30 days.');
  return {
    action: LINGVA_HOSTED_ORGANIZATION_ACTIONS.resendInvite,
    organizationId: identifier(input.organizationId, 'organizationId'),
    inviteId: identifier(input.inviteId, 'inviteId', LINGVA_HOSTED_ORGANIZATION_INVITE_ID_PATTERN),
    expiresInDays,
  };
}

/** Revocation cancels a pending invitation; it never removes an accepted membership. */
export function createLingvaHostedOrganizationInviteRevokePayload(input: { organizationId: string; inviteId: string }) {
  return {
    action: LINGVA_HOSTED_ORGANIZATION_ACTIONS.revokeInvite,
    organizationId: identifier(input.organizationId, 'organizationId'),
    inviteId: identifier(input.inviteId, 'inviteId', LINGVA_HOSTED_ORGANIZATION_INVITE_ID_PATTERN),
  };
}

/** Groups contain account IDs only; nesting and guest membership are forbidden by the server. */
export interface LingvaHostedOrganizationGroup {
  organizationId: string;
  groupId: string;
  name: string;
  memberIds: string[];
  status: 'active' | 'revoked';
  updatedAt: string;
}
export interface LingvaHostedOrganizationAccessSource {
  type: 'organization' | 'direct' | 'group';
  id: string;
  name?: string;
  role: LingvaHostedProjectMemberRole;
}
export interface LingvaHostedOrganizationProjectAccess {
  legacy: boolean;
  role?: LingvaHostedProjectMemberRole;
  sources?: LingvaHostedOrganizationAccessSource[];
}
