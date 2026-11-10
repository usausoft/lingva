import { describe, expect, it } from 'vitest';
import {
  LINGVA_HOSTED_PROJECT_AUDIT_ACTION,
  LINGVA_HOSTED_PROJECT_AUDIT_ACTIONS,
  createLingvaHostedProjectAuditEventPayload,
  isLingvaHostedProjectAuditAction,
  normalizeLingvaHostedProjectAuditEvent,
  type LingvaHostedProjectAuditAction,
} from './hosted-projects';

const oldActions = [
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
const fields = {
  actorId: ' publisher ',
  auditId: 'audit_12345678-abcd-4000-9000-123456789abc',
  createdAt: '2026-01-01T00:00:00.000Z',
  projectId: 'Demo-App',
  summary: ' Published translations ',
  targetId: ' publish_123 ',
  targetType: 'delivery' as const,
};
const expected = {
  actorId: 'publisher',
  auditId: fields.auditId,
  createdAt: fields.createdAt,
  projectId: 'demo-app',
  summary: 'Published translations',
  targetId: 'publish_123',
  targetType: 'delivery',
};

describe('publication audit action compatibility', () => {
  it('exports the named publication action', () => {
    expect(LINGVA_HOSTED_PROJECT_AUDIT_ACTION).toHaveProperty('deliveryPublish', 'delivery.publish');
  });

  it('adds exactly the publication action to the existing vocabulary', () => {
    expect([...LINGVA_HOSTED_PROJECT_AUDIT_ACTIONS].sort()).toEqual([...oldActions, 'delivery.publish'].sort());
    expect(new Set(LINGVA_HOSTED_PROJECT_AUDIT_ACTIONS).size).toBe(13);
  });

  it('recognizes the exact publication wire literal', () => {
    expect(isLingvaHostedProjectAuditAction('delivery.publish')).toBe(true);
  });

  it('normalizes publication with the existing event fields', () => {
    const input = { ...fields, action: 'delivery.publish' as LingvaHostedProjectAuditAction };
    const before = structuredClone(input);
    expect(normalizeLingvaHostedProjectAuditEvent(input)).toEqual({ ...expected, action: 'delivery.publish' });
    expect(input).toEqual(before);
  });

  it('uses the existing audit-create request shape without adding authority fields', () => {
    const payload = createLingvaHostedProjectAuditEventPayload({
      ...fields,
      action: 'delivery.publish' as LingvaHostedProjectAuditAction,
    });
    expect(payload).toEqual({ action: 'createAuditEvent', auditEvent: { ...expected, action: 'delivery.publish' } });
  });

  it.each(oldActions)('preserves the legacy %s event and request', (action) => {
    const input = { ...fields, action };
    expect(isLingvaHostedProjectAuditAction(action)).toBe(true);
    expect(normalizeLingvaHostedProjectAuditEvent(input)).toEqual({ ...expected, action });
    expect(createLingvaHostedProjectAuditEventPayload(input)).toEqual({
      action: 'createAuditEvent',
      auditEvent: { ...expected, action },
    });
  });

  it.each(['delivery.publish ', 'Delivery.publish', 'delivery.published', 'member.delete', ''])(
    'keeps unknown action %j invalid',
    (action) => {
      expect(isLingvaHostedProjectAuditAction(action)).toBe(false);
      expect(() => normalizeLingvaHostedProjectAuditEvent({ ...fields, action: action as never })).toThrow(
        /audit action/
      );
      expect(() => createLingvaHostedProjectAuditEventPayload({ ...fields, action: action as never })).toThrow(
        /audit action/
      );
    }
  );

  it.each([
    ['actor', { actorId: 'x'.repeat(161) }],
    ['audit ID', { auditId: 'invalid' }],
    ['project', { projectId: '!' }],
    ['summary', { summary: 'x'.repeat(241) }],
    ['target ID', { targetId: 'x'.repeat(161) }],
    ['target type', { targetType: 'publication' as never }],
  ])('retains %s validation for publication', (_label, patch) => {
    expect(() =>
      normalizeLingvaHostedProjectAuditEvent({ ...fields, ...patch, action: 'delivery.publish' as never })
    ).toThrow();
  });
});
