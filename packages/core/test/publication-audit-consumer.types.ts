import {
  LINGVA_HOSTED_PROJECT_AUDIT_ACTION,
  createLingvaHostedProjectAuditEventPayload,
  normalizeLingvaHostedProjectAuditEvent,
  type LingvaHostedProjectAuditAction,
  type LingvaHostedProjectAuditEvent,
} from '@lingva/core';

const previousLabels = {
  'apiKey.create': 'Created key',
  'apiKey.revoke': 'Revoked key',
  'delivery.invalidate': 'Queued invalidation',
  'delivery.rollback': 'Rolled back',
  'delivery.workflow': 'Delivery workflow',
  'draft.approve': 'Approved draft',
  'draft.promote': 'Promoted draft',
  'member.revoke': 'Revoked member',
  'member.upsert': 'Updated member',
  'project.create': 'Created project',
  'project.update': 'Updated project',
  'translationKey.delete': 'Deleted key',
};
const labels: Record<LingvaHostedProjectAuditAction, string> = {
  ...previousLabels,
  [LINGVA_HOSTED_PROJECT_AUDIT_ACTION.deliveryPublish]: 'Published translations',
};
// @ts-expect-error An exhaustive old map must handle the added publication action.
const incomplete: Record<LingvaHostedProjectAuditAction, string> = previousLabels;
// @ts-expect-error Unknown wire actions remain outside the public union.
const unsupported: LingvaHostedProjectAuditAction = 'delivery.published';
const action: LingvaHostedProjectAuditAction = 'delivery.publish';
const event: LingvaHostedProjectAuditEvent = normalizeLingvaHostedProjectAuditEvent({
  action,
  actorId: 'synthetic-publisher',
  auditId: 'audit_12345678',
  projectId: 'demo-app',
  targetType: 'delivery',
  targetId: 'publish_123',
});
const payload = createLingvaHostedProjectAuditEventPayload(event);
void [labels, incomplete, unsupported, payload];
