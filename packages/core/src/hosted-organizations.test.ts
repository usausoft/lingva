import { describe, expect, it } from 'vitest';
import {
  createLingvaHostedOrganizationInviteAcceptPayload,
  createLingvaHostedOrganizationInviteResendPayload,
  createLingvaHostedOrganizationInviteRevokePayload,
  createLingvaHostedOrganizationInvitePayload,
  createLingvaHostedOrganizationPayload,
  type LingvaHostedOrganizationInviteCreateInput,
} from './hosted-organizations';

const invitation: LingvaHostedOrganizationInviteCreateInput = {
  organizationId: 'acme-org',
  email: ' Person@Example.test ',
};

describe('organization request contracts', () => {
  it('excludes browser-provided ownership and commercial claims from creation', () => {
    const input = {
      name: ' Acme ',
      requestId: '550e8400-e29b-41d4-a716-446655440000',
      tier: 'business',
      ownerId: 'another-user',
      organizationId: 'chosen-id',
    };
    expect(createLingvaHostedOrganizationPayload(input)).toEqual({
      action: 'createOrganization',
      name: 'Acme',
      requestId: input.requestId,
    });
  });

  it.each(['', '   ', 'x'.repeat(81)])('rejects invalid organization name %j', (name) => {
    expect(() =>
      createLingvaHostedOrganizationPayload({ name, requestId: '550e8400-e29b-41d4-a716-446655440000' })
    ).toThrow(/name/);
  });

  it('defaults invitation to least-privileged regular membership without project or group grants', () => {
    expect(createLingvaHostedOrganizationInvitePayload(invitation)).toEqual({
      action: 'createOrganizationInvite',
      organizationId: 'acme-org',
      email: 'person@example.test',
      role: 'member',
      expiresInDays: 14,
      groupIds: [],
      projectGrants: [],
    });
  });

  it('copies grants and deduplicates group IDs without mutating caller data', () => {
    const groups = [' translators ', 'translators'];
    const grants = [{ projectId: 'web-app', role: 'editor' as const }];
    const result = createLingvaHostedOrganizationInvitePayload({
      ...invitation,
      groupIds: groups,
      projectGrants: grants,
    });
    expect(result.groupIds).toEqual(['translators']);
    expect(result.projectGrants).toEqual(grants);
    expect(result.projectGrants[0]).not.toBe(grants[0]);
    expect(groups).toEqual([' translators ', 'translators']);
  });

  it.each(['owner', 'support', 'staff', 'dev', 'unknown'])('rejects ownership and platform role %s', (role) => {
    expect(() =>
      createLingvaHostedOrganizationInvitePayload({
        ...invitation,
        role: role as LingvaHostedOrganizationInviteCreateInput['role'],
      })
    ).toThrow(/role/);
  });

  it.each(['owner', 'member', 'support'])('rejects invalid project grant role %s', (role) => {
    expect(() =>
      createLingvaHostedOrganizationInvitePayload({
        ...invitation,
        projectGrants: [{ projectId: 'web-app', role: role as 'editor' }],
      })
    ).toThrow(/project role/);
  });

  it('rejects conflicting grants instead of selecting an implicit privilege', () => {
    expect(() =>
      createLingvaHostedOrganizationInvitePayload({
        ...invitation,
        projectGrants: [
          { projectId: 'web-app', role: 'viewer' },
          { projectId: 'web-app', role: 'admin' },
        ],
      })
    ).toThrow(/duplicate/);
  });

  it('restricts guests to direct project grants', () => {
    expect(() =>
      createLingvaHostedOrganizationInvitePayload({
        ...invitation,
        role: 'guest',
        groupIds: ['translators'],
      })
    ).toThrow(/guests/);
    expect(
      createLingvaHostedOrganizationInvitePayload({
        ...invitation,
        role: 'guest',
        projectGrants: [{ projectId: 'web-app', role: 'viewer' }],
      }).role
    ).toBe('guest');
  });

  it.each([0, -1, 1.5, 31, NaN, Infinity])('rejects invalid expiry %s', (expiresInDays) => {
    expect(() => createLingvaHostedOrganizationInvitePayload({ ...invitation, expiresInDays })).toThrow(/expiry/);
  });

  it.each(['person', 'person@', '@example.test', 'person @example.test', 'x'.repeat(255)])(
    'rejects invalid email %s',
    (email) => {
      expect(() => createLingvaHostedOrganizationInvitePayload({ ...invitation, email })).toThrow(/email/);
    }
  );

  it('bounds assignment counts before deduplication', () => {
    expect(() =>
      createLingvaHostedOrganizationInvitePayload({
        ...invitation,
        groupIds: Array.from({ length: 101 }, () => 'translators'),
      })
    ).toThrow(/assignments/);
  });

  it.each(['../other', 'org/path', ''])('rejects unsafe organization identifiers %s', (organizationId) => {
    expect(() => createLingvaHostedOrganizationInvitePayload({ ...invitation, organizationId })).toThrow(
      /organizationId/
    );
  });

  it('strips identity and role claims from invite acceptance', () => {
    const input = {
      organizationId: 'acme-org',
      token: ' secret-token ',
      userId: 'victim',
      email: 'victim@example.test',
      role: 'owner',
    };
    expect(createLingvaHostedOrganizationInviteAcceptPayload(input)).toEqual({
      action: 'acceptOrganizationInvite',
      organizationId: 'acme-org',
      token: 'secret-token',
    });
  });

  it.each(['', ' ', 'x'.repeat(257)])('rejects invalid acceptance token', (token) => {
    expect(() => createLingvaHostedOrganizationInviteAcceptPayload({ organizationId: 'acme-org', token })).toThrow(
      /token/
    );
  });
});

it('preserves a normalized creation request ID for response-loss retries', () => {
  expect(
    createLingvaHostedOrganizationPayload({ name: 'Acme', requestId: '550E8400-E29B-41D4-A716-446655440000' })
  ).toEqual({ action: 'createOrganization', name: 'Acme', requestId: '550e8400-e29b-41d4-a716-446655440000' });
  expect(() => createLingvaHostedOrganizationPayload({ name: 'Acme', requestId: 'invalid' })).toThrow('UUID v4');
});

it('validates resend and revocation without accepting identity or role claims', () => {
  const input = {
    organizationId: 'org_acme',
    inviteId: 'invite_550e8400-e29b-41d4-a716-446655440000',
    actorId: 'another-user',
    role: 'owner',
  };
  expect(createLingvaHostedOrganizationInviteResendPayload(input)).toEqual({
    action: 'resendOrganizationInvite',
    organizationId: input.organizationId,
    inviteId: input.inviteId,
    expiresInDays: 14,
  });
  expect(createLingvaHostedOrganizationInviteRevokePayload(input)).toEqual({
    action: 'revokeOrganizationInvite',
    organizationId: input.organizationId,
    inviteId: input.inviteId,
  });
  expect(() => createLingvaHostedOrganizationInviteResendPayload({ ...input, expiresInDays: 31 })).toThrow(/expiry/);
  expect(() => createLingvaHostedOrganizationInviteRevokePayload({ ...input, inviteId: 'bad-id' })).toThrow(/inviteId/);
});
