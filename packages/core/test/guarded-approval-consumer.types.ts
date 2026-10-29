import {
  createLingvaGuardedApprovalContextPayload,
  createLingvaGuardedApprovalPayload,
  parseLingvaGuardedApprovalContextResponse,
  parseLingvaGuardedApprovalResponse,
  type LingvaGuardedApprovalScope,
  type LingvaGuardedApprovalContextPayload,
  type LingvaGuardedApprovalPayload,
  type LingvaGuardedApprovalContextResponse,
  type LingvaGuardedApprovalResponse,
} from '@lingva/core';

const guardedScope: LingvaGuardedApprovalScope = {
  projectId: 'project_demo',
  environment: 'dev',
  locator: {
    entityKey: 'authoring#dev#en#hero.title#draft_one',
    draftId: 'draft_one',
    key: 'hero.title',
    locale: 'en',
  },
};
export const guardedContextPayload: LingvaGuardedApprovalContextPayload =
  createLingvaGuardedApprovalContextPayload(guardedScope);
export const guardedApprovalPayload: LingvaGuardedApprovalPayload = createLingvaGuardedApprovalPayload({
  ...guardedScope,
  contextToken: 'a'.repeat(64),
  operationId: '11111111-1111-4111-8111-111111111111',
});
export const guardedContextObservation: LingvaGuardedApprovalContextResponse | null =
  parseLingvaGuardedApprovalContextResponse({}, guardedScope);
export const guardedApprovalObservation: LingvaGuardedApprovalResponse | null = parseLingvaGuardedApprovalResponse(
  {},
  guardedApprovalPayload.operationId
);

// @ts-expect-error Actor attribution is not a guarded request field.
createLingvaGuardedApprovalContextPayload({ ...guardedScope, actorId: 'not-a-request-field' });
// @ts-expect-error Guarded approval cannot carry a caller-approved identity.
createLingvaGuardedApprovalPayload({ ...guardedApprovalPayload, approvedBy: 'not-a-request-field' });
export const guardedOutcome = (response: LingvaGuardedApprovalResponse): 'approved' => response.result.outcome;
