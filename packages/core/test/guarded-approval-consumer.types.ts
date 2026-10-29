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

import {
  createLingvaGuardedApprovalHttpClient,
  LingvaGuardedApprovalHttpError,
  type LingvaGuardedApprovalHttpOptions,
  type LingvaGuardedApprovalHttpClient,
  type LingvaGuardedApprovalHttpCallOptions,
  type LingvaGuardedApprovalHttpErrorKind,
  type LingvaGuardedApprovalHttpPhase,
  type LingvaGuardedApprovalHttpRecovery,
} from '@lingva/core';
const guardedHttpOptions: LingvaGuardedApprovalHttpOptions = {
  endpoint: 'https://example.invalid/review',
  getBearerToken: (signal: AbortSignal) => {
    void signal;
    return 'synthetic.payload.signature';
  },
};
export const guardedHttpClient: LingvaGuardedApprovalHttpClient =
  createLingvaGuardedApprovalHttpClient(guardedHttpOptions);
const guardedCall: LingvaGuardedApprovalHttpCallOptions = { signal: new AbortController().signal };
export const guardedHttpContext: Promise<LingvaGuardedApprovalContextResponse> = guardedHttpClient.getContext(
  guardedScope,
  guardedCall
);
export const guardedHttpApproval: Promise<LingvaGuardedApprovalResponse> = guardedHttpClient.approve(
  { ...guardedScope, contextToken: 'a'.repeat(64), operationId: '11111111-1111-4111-8111-111111111111' },
  guardedCall
);
export function guardedHttpErrorFields(error: LingvaGuardedApprovalHttpError) {
  const kind: LingvaGuardedApprovalHttpErrorKind = error.kind;
  const phase: LingvaGuardedApprovalHttpPhase = error.phase;
  const recovery: LingvaGuardedApprovalHttpRecovery = error.recovery;
  return { kind, phase, recovery };
}
// @ts-expect-error Arbitrary request headers are not a supported escape hatch.
createLingvaGuardedApprovalHttpClient({ ...guardedHttpOptions, headers: { 'X-Actor': 'caller' } });
guardedHttpClient.approve({
  ...guardedScope,
  contextToken: 'a'.repeat(64),
  operationId: '11111111-1111-4111-8111-111111111111',
  // @ts-expect-error Actor attribution is never a command field.
  actorId: 'caller',
});
