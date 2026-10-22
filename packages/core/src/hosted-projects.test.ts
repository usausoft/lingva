import { describe, expect, it } from 'vitest';
import {
  LINGVA_HOSTED_API_KEY_LIMITS,
  LINGVA_HOSTED_PROJECT_ACTIONS,
  createLingvaHostedApiKeyPayload,
  createLingvaHostedApiKeyRevokePayload,
  createLingvaHostedEnvironmentPayload,
  createLingvaHostedInviteAcceptPayload,
  createLingvaHostedInvitePayload,
  createLingvaHostedInviteRevokePayload,
  createLingvaHostedProjectPayload,
  createLingvaHostedProjectDeletePayload,
  createLingvaHostedProjectAdminUpdatePayload,
  createLingvaHostedCustomerUpdatePayload,
  createLingvaHostedProjectMemberPayload,
  createLingvaHostedProjectAuditEventPayload,
  createLingvaHostedProjectMemberRevokePayload,
  createLingvaHostedProjectRecord,
  createLingvaHostedProjectUpdatePayload,
  isLingvaHostedProjectAction,
  isLingvaHostedProjectAuditAction,
  isLingvaHostedProjectMemberRole,
  normalizeLingvaHostedProjectAuditEvent,
  normalizeLingvaHostedEnvironment,
} from './hosted-projects';

describe('hosted project contract', () => {
  it('defines increasing API-key limits for every hosted tier', () => {
    expect(LINGVA_HOSTED_API_KEY_LIMITS).toEqual({
      business: 250,
      free: 3,
      internal: 1_000,
      plus: 10,
      pro: 50,
    });
  });

  it('creates free-tier project records with safe default environments', () => {
    const record = createLingvaHostedProjectRecord({
      projectId: 'Web_App',
      ownerId: 'user_123',
      name: 'Web App',
      locales: ['ru', 'en', 'en'],
      defaultLocale: 'en',
    });

    expect(record.projectId).toBe('web_app');
    expect(record.tier).toBe('free');
    expect(record.locales).toEqual(['en', 'ru']);
    expect(record.environments.map((environment) => environment.environmentId)).toEqual(['dev', 'stage', 'prod']);
    expect(record.environments.map((environment) => environment.kind)).toEqual([
      'development',
      'staging',
      'production',
    ]);
  });

  it('normalizes environment payloads for hosted control-plane APIs', () => {
    expect(
      createLingvaHostedEnvironmentPayload({
        projectId: 'lingva-web',
        environmentId: 'Stage',
        name: 'Stage',
        publishApiUrl: ' https://publish.example.test ',
      })
    ).toEqual({
      action: LINGVA_HOSTED_PROJECT_ACTIONS.upsertEnvironment,
      projectId: 'lingva-web',
      environmentId: 'stage',
      deliveryMode: 'remote',
      kind: 'staging',
      name: 'Stage',
      publishApiUrl: 'https://publish.example.test',
    });
  });

  it('creates a stable create-project payload', () => {
    expect(
      createLingvaHostedProjectPayload({
        projectId: 'demo-app',
        ownerId: 'owner@example.test',
        name: 'Demo App',
        tier: 'plus',
        environments: [
          {
            environmentId: 'preview',
            deliveryMode: 'local',
            kind: 'custom',
          },
        ],
      })
    ).toMatchObject({
      action: LINGVA_HOSTED_PROJECT_ACTIONS.createProject,
      projectId: 'demo-app',
      ownerId: 'owner@example.test',
      name: 'Demo App',
      defaultLocale: 'en',
      tier: 'plus',
      environments: [
        {
          projectId: 'demo-app',
          environmentId: 'preview',
          deliveryMode: 'local',
          kind: 'custom',
        },
      ],
    });
  });

  it('creates an owner-scoped delete-project payload', () => {
    expect(
      createLingvaHostedProjectDeletePayload({
        ownerId: ' owner-user ',
        projectId: 'Demo_App',
      })
    ).toEqual({
      action: LINGVA_HOSTED_PROJECT_ACTIONS.deleteProject,
      ownerId: 'owner-user',
      projectId: 'demo_app',
    });
  });

  it('normalizes hosted invite create and revoke payloads', () => {
    expect(
      createLingvaHostedInvitePayload({
        createdBy: 'admin-user',
        email: ' Translator@Example.TEST ',
        expiresInDays: 14,
        note: '  Launch batch ',
        projectId: 'Demo_App',
        role: 'translator',
      })
    ).toEqual({
      action: LINGVA_HOSTED_PROJECT_ACTIONS.createInvite,
      createdBy: 'admin-user',
      email: 'translator@example.test',
      expiresInDays: 14,
      note: 'Launch batch',
      projectId: 'demo_app',
      role: 'translator',
    });

    expect(
      createLingvaHostedInviteRevokePayload({
        projectId: 'Demo_App',
        inviteId: 'INVITE_12345678-ABCD-4000-9000-123456789ABC',
      })
    ).toEqual({
      action: LINGVA_HOSTED_PROJECT_ACTIONS.revokeInvite,
      projectId: 'demo_app',
      inviteId: 'invite_12345678-abcd-4000-9000-123456789abc',
    });

    expect(
      createLingvaHostedInviteAcceptPayload({
        acceptedBy: ' customer-user ',
        projectId: 'Demo_App',
        token: ' raw-invite-token ',
        userEmail: ' Customer@Example.TEST ',
        userId: ' customer-user ',
      })
    ).toEqual({
      action: LINGVA_HOSTED_PROJECT_ACTIONS.acceptInvite,
      acceptedBy: 'customer-user',
      projectId: 'demo_app',
      token: 'raw-invite-token',
      userEmail: 'customer@example.test',
      userId: 'customer-user',
    });
  });

  it('normalizes hosted api key create and revoke payloads', () => {
    expect(
      createLingvaHostedApiKeyPayload({
        createdBy: 'admin-user',
        name: '  CI publish key ',
        projectId: 'Demo_App',
        scopes: ['delivery:read', 'delivery:write', 'delivery:read'],
      })
    ).toEqual({
      action: LINGVA_HOSTED_PROJECT_ACTIONS.createApiKey,
      createdBy: 'admin-user',
      name: 'CI publish key',
      projectId: 'demo_app',
      scopes: ['delivery:read', 'delivery:write'],
    });

    expect(
      createLingvaHostedApiKeyRevokePayload({
        projectId: 'Demo_App',
        apiKeyId: 'KEY_12345678-ABCD-4000-9000-123456789ABC',
      })
    ).toEqual({
      action: LINGVA_HOSTED_PROJECT_ACTIONS.revokeApiKey,
      projectId: 'demo_app',
      apiKeyId: 'key_12345678-abcd-4000-9000-123456789abc',
    });
  });

  it('normalizes hosted project member upsert and revoke payloads', () => {
    expect(
      createLingvaHostedProjectMemberPayload({
        createdBy: 'owner-user',
        projectId: 'Demo_App',
        role: 'editor',
        updatedBy: 'owner-user',
        userId: ' customer-user ',
      })
    ).toEqual({
      action: LINGVA_HOSTED_PROJECT_ACTIONS.upsertMember,
      createdBy: 'owner-user',
      projectId: 'demo_app',
      role: 'editor',
      updatedBy: 'owner-user',
      userId: 'customer-user',
    });

    expect(
      createLingvaHostedProjectMemberRevokePayload({
        projectId: 'Demo_App',
        updatedBy: 'owner-user',
        userId: 'customer-user',
      })
    ).toEqual({
      action: LINGVA_HOSTED_PROJECT_ACTIONS.revokeMember,
      projectId: 'demo_app',
      updatedBy: 'owner-user',
      userId: 'customer-user',
    });
  });

  it('normalizes hosted project audit events', () => {
    expect(
      normalizeLingvaHostedProjectAuditEvent({
        action: 'member.upsert',
        actorId: ' owner-user ',
        auditId: 'AUDIT_12345678-ABCD-4000-9000-123456789ABC',
        projectId: 'Demo_App',
        summary: '  owner-user changed member role ',
        targetId: ' customer-user ',
        targetType: 'member',
      })
    ).toEqual({
      action: 'member.upsert',
      actorId: 'owner-user',
      auditId: 'audit_12345678-abcd-4000-9000-123456789abc',
      projectId: 'demo_app',
      summary: 'owner-user changed member role',
      targetId: 'customer-user',
      targetType: 'member',
    });

    expect(
      createLingvaHostedProjectAuditEventPayload({
        action: 'draft.approve',
        actorId: 'owner-user',
        auditId: 'audit_12345678-abcd-4000-9000-123456789abc',
        projectId: 'demo-app',
        targetId: 'draft_123',
        targetType: 'draft',
      })
    ).toEqual({
      action: LINGVA_HOSTED_PROJECT_ACTIONS.createAuditEvent,
      auditEvent: {
        action: 'draft.approve',
        actorId: 'owner-user',
        auditId: 'audit_12345678-abcd-4000-9000-123456789abc',
        createdAt: undefined,
        projectId: 'demo-app',
        summary: undefined,
        targetId: 'draft_123',
        targetType: 'draft',
      },
    });
  });

  it('rejects invalid project and environment identifiers', () => {
    expect(() =>
      createLingvaHostedProjectRecord({
        projectId: '../secret',
        ownerId: 'owner',
        name: 'Bad',
      })
    ).toThrow(/projectId/);

    expect(() =>
      normalizeLingvaHostedEnvironment({
        projectId: 'demo-app',
        environmentId: 'x',
      })
    ).toThrow(/environmentId/);

    expect(() =>
      createLingvaHostedInvitePayload({
        createdBy: 'owner',
        expiresInDays: 999,
        projectId: 'demo-app',
        role: 'translator',
      })
    ).toThrow(/expiry/);

    expect(() =>
      createLingvaHostedInvitePayload({
        createdBy: 'admin-user',
        projectId: 'demo-app',
        role: 'owner',
      })
    ).toThrow(/ownership/);

    expect(() =>
      createLingvaHostedInviteAcceptPayload({
        projectId: 'demo-app',
        token: '',
        userId: 'customer-user',
      })
    ).toThrow(/invite token/);

    expect(() =>
      createLingvaHostedApiKeyPayload({
        createdBy: 'owner',
        name: '',
        projectId: 'demo-app',
      })
    ).toThrow(/api key name/);

    expect(() =>
      createLingvaHostedProjectMemberPayload({
        projectId: 'demo-app',
        role: 'superadmin' as never,
        userId: 'customer-user',
      })
    ).toThrow(/member role/);

    expect(() =>
      normalizeLingvaHostedProjectAuditEvent({
        action: 'member.delete' as never,
        actorId: 'owner-user',
        auditId: 'audit_12345678-abcd-4000-9000-123456789abc',
        projectId: 'demo-app',
      })
    ).toThrow(/audit action/);
  });

  it('detects supported hosted project actions', () => {
    expect(isLingvaHostedProjectAction('createProject')).toBe(true);
    expect(isLingvaHostedProjectAction('deleteProject')).toBe(true);
    expect(isLingvaHostedProjectAction('createInvite')).toBe(true);
    expect(isLingvaHostedProjectAction('acceptInvite')).toBe(true);
    expect(isLingvaHostedProjectAction('createApiKey')).toBe(true);
    expect(isLingvaHostedProjectAction('deleteEverything')).toBe(false);
    expect(isLingvaHostedProjectAction('listAuditEvents')).toBe(true);
    expect(isLingvaHostedProjectAction('updateProject')).toBe(true);
    expect(isLingvaHostedProjectAction('adminUpdateProject')).toBe(true);
    expect(isLingvaHostedProjectAction('listCustomers')).toBe(true);
    expect(isLingvaHostedProjectAction('updateCustomer')).toBe(true);
    expect(isLingvaHostedProjectAuditAction('apiKey.create')).toBe(true);
    expect(isLingvaHostedProjectAuditAction('delivery.rollback')).toBe(true);
    expect(isLingvaHostedProjectAuditAction('member.upsert')).toBe(true);
    expect(isLingvaHostedProjectAuditAction('member.delete')).toBe(false);
    expect(isLingvaHostedProjectMemberRole('editor')).toBe(true);
    expect(isLingvaHostedProjectMemberRole('superadmin')).toBe(false);
  });

  it('normalizes privileged project and customer mutations', () => {
    expect(
      createLingvaHostedProjectAdminUpdatePayload({
        defaultLocale: 'EN',
        description: ' Managed globally ',
        locales: ['ru', 'en'],
        name: ' Managed project ',
        projectId: 'Managed_Project',
        tier: 'business',
      })
    ).toEqual({
      action: 'adminUpdateProject',
      project: {
        defaultLocale: 'en',
        description: 'Managed globally',
        locales: ['en', 'ru'],
        name: 'Managed project',
        projectId: 'managed_project',
        tier: 'business',
      },
    });
    expect(
      createLingvaHostedCustomerUpdatePayload({
        enabled: false,
        planTier: 'pro',
        role: 'customer',
        username: ' customer-one ',
      })
    ).toEqual({
      action: 'updateCustomer',
      customer: { enabled: false, planTier: 'pro', role: 'customer', username: 'customer-one' },
    });
  });

  describe('createLingvaHostedProjectUpdatePayload', () => {
    it('normalizes optional names and rejects blank or oversized names', () => {
      const project = { projectId: 'demo', defaultLocale: 'en', locales: ['en'] };
      expect(createLingvaHostedProjectUpdatePayload({ ...project, name: '  Mobile app  ' }).name).toBe('Mobile app');
      expect(createLingvaHostedProjectUpdatePayload(project)).not.toHaveProperty('name');
      expect(() => createLingvaHostedProjectUpdatePayload({ ...project, name: ' ' })).toThrow();
      expect(() => createLingvaHostedProjectUpdatePayload({ ...project, name: 'x'.repeat(121) })).toThrow();
    });

    it('normalizes a valid locale list and pins the default first', () => {
      expect(
        createLingvaHostedProjectUpdatePayload({
          projectId: 'Web_App',
          defaultLocale: 'EN',
          locales: ['ru', 'en', 'fr-CA', 'EN'],
        })
      ).toEqual({
        action: LINGVA_HOSTED_PROJECT_ACTIONS.updateProject,
        projectId: 'web_app',
        defaultLocale: 'en',
        locales: ['en', 'ru', 'fr-ca'],
      });
    });

    it('rejects an empty locale list', () => {
      expect(() =>
        createLingvaHostedProjectUpdatePayload({
          projectId: 'demo-app',
          defaultLocale: 'en',
          locales: [],
        })
      ).toThrow(/at least one entry/);
    });

    it('rejects defaultLocale missing from locales', () => {
      expect(() =>
        createLingvaHostedProjectUpdatePayload({
          projectId: 'demo-app',
          defaultLocale: 'fr',
          locales: ['en', 'ru'],
        })
      ).toThrow(/defaultLocale must be present/);
    });

    it('rejects malformed locale codes', () => {
      expect(() =>
        createLingvaHostedProjectUpdatePayload({
          projectId: 'demo-app',
          defaultLocale: 'en',
          locales: ['en', 'english!'],
        })
      ).toThrow(/locale has an invalid format/);

      expect(() =>
        createLingvaHostedProjectUpdatePayload({
          projectId: 'demo-app',
          defaultLocale: '12',
          locales: ['12'],
        })
      ).toThrow(/defaultLocale has an invalid format/);
    });
  });
});
