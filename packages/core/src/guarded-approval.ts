/** Portable data codecs only. Parsing observations never authenticates or authorizes a caller. */
export const LINGVA_GUARDED_APPROVAL_ACTIONS = Object.freeze({
  context: 'review-context',
  approve: 'review-mutate',
} as const);
export const LINGVA_GUARDED_APPROVAL_REQUEST_MAX_BYTES = 16 * 1024;
export const LINGVA_GUARDED_APPROVAL_RESPONSE_MAX_BYTES = 128 * 1024;
const APPROVE_COMMAND = 'approve';
const APPROVAL_OUTCOME = 'approved';
const DRAFT_STATUSES = { draft: 'draft', approved: APPROVAL_OUTCOME } as const;
const INVALID_REQUEST = 'Invalid guarded approval request.';
const CONTEXT_TOKEN = /^[a-f0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OUTCOMES = [APPROVAL_OUTCOME, 'changes-requested', 'rejected'] as const;
const LOCATOR_FIELDS = ['entityKey', 'draftId', 'key', 'locale', 'variantId'];
const SCOPE_FIELDS = ['projectId', 'environment', 'locator'];
const encoder = new TextEncoder();

export interface LingvaGuardedApprovalLocator {
  entityKey: string;
  draftId: string;
  key: string;
  locale: string;
  variantId?: string;
}
export interface LingvaGuardedApprovalScope {
  projectId: string;
  environment: string;
  locator: LingvaGuardedApprovalLocator;
}
export interface LingvaGuardedApprovalCommand extends LingvaGuardedApprovalScope {
  contextToken: string;
  operationId: string;
}
export interface LingvaGuardedApprovalContextPayload extends LingvaGuardedApprovalScope {
  action: typeof LINGVA_GUARDED_APPROVAL_ACTIONS.context;
}
export interface LingvaGuardedApprovalPayload extends LingvaGuardedApprovalCommand {
  action: typeof LINGVA_GUARDED_APPROVAL_ACTIONS.approve;
  command: typeof APPROVE_COMMAND;
}
export type LingvaGuardedApprovalOutcome = (typeof OUTCOMES)[number];
export interface LingvaGuardedApprovalContext extends LingvaGuardedApprovalScope {
  actorId: string;
  contextToken: string;
  isCurrent: boolean;
  draft: { value: string; status: 'draft' | 'approved'; authorId?: string; approvedBy?: string; approvedAt?: string };
  review: { revision: number; assigneeId?: string; outcome?: LingvaGuardedApprovalOutcome };
  baseline: { revision: string; publishId: string } | null;
  permissions: { comment: boolean; assign: boolean; decide: boolean };
}
export interface LingvaGuardedApprovalContextResponse {
  ok: true;
  context: LingvaGuardedApprovalContext;
}
export interface LingvaGuardedApprovalResult {
  operationId: string;
  reviewRevision: number;
  outcome: typeof APPROVAL_OUTCOME;
  approvedAt: string;
}
export interface LingvaGuardedApprovalResponse {
  ok: true;
  result: LingvaGuardedApprovalResult;
}

function object(value: unknown): value is object {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  // Ordinary JSON objects may originate in another realm; their root prototype still has no parent.
  return prototype === null || Object.getPrototypeOf(prototype) === null;
}
function data(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor?.enumerable && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}
function only(value: object, fields: readonly string[]): boolean {
  return (
    Object.getOwnPropertySymbols(value).length === 0 &&
    Object.getOwnPropertyNames(value).every((key) => fields.includes(key))
  );
}
function string(value: unknown, maximum = 1024): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum && value.trim() === value;
}
function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function uuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
function token(value: unknown): value is string {
  return typeof value === 'string' && CONTEXT_TOKEN.test(value);
}
function outcome(value: unknown): value is LingvaGuardedApprovalOutcome {
  return typeof value === 'string' && (OUTCOMES as readonly string[]).includes(value);
}
function timestamp(value: unknown): value is string {
  if (!string(value)) return false;
  const match = /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/.exec(
    value
  );
  if (!match) return false;
  const year = Number(match[1]),
    month = Number(match[2]),
    day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= days[month - 1]! &&
    Number(match[4]) <= 23 &&
    Number(match[5]) <= 59 &&
    Number(match[6]) <= 59 &&
    (match[7] === 'Z' || (Number(match[8]) <= 23 && Number(match[9]) <= 59)) &&
    Number.isFinite(Date.parse(value))
  );
}

/** Counts JSON data without executing toJSON, getters or caller iterators. */
function fitsJson(value: unknown, maximum: number): boolean {
  const stack: ({ value: unknown } | { exit: object })[] = [{ value }];
  const active = new WeakSet<object>();
  let bytes = 0;
  const addString = (text: string) => {
    if (text.length > maximum) return false;
    bytes += encoder.encode(JSON.stringify(text)).byteLength;
    return bytes <= maximum;
  };
  while (stack.length) {
    const frame = stack.pop()!;
    if ('exit' in frame) {
      active.delete(frame.exit);
      continue;
    }
    const current = frame.value;
    if (current === null) bytes += 4;
    else if (typeof current === 'string') {
      if (!addString(current)) return false;
    } else if (typeof current === 'boolean') bytes += current ? 4 : 5;
    else if (typeof current === 'number' && Number.isFinite(current)) bytes += JSON.stringify(current).length;
    else if (typeof current === 'object') {
      if (active.has(current)) return false;
      active.add(current);
      stack.push({ exit: current });
      const children: unknown[] = [];
      if (Array.isArray(current)) {
        const length = data(current, 'length') ?? Object.getOwnPropertyDescriptor(current, 'length')?.value;
        if (!integer(length) || length > maximum) return false;
        bytes += 2 + Math.max(0, length - 1);
        if (bytes > maximum) return false;
        for (let index = 0; index < length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
          if (descriptor && !Object.hasOwn(descriptor, 'value')) return false;
          children.push(descriptor?.value === undefined ? null : descriptor.value);
        }
      } else {
        if (!object(current)) return false;
        bytes += 2;
        let entries = 0;
        for (const key of Object.keys(current)) {
          const descriptor = Object.getOwnPropertyDescriptor(current, key);
          if (!descriptor || !Object.hasOwn(descriptor, 'value')) return false;
          if (descriptor.value === undefined) continue;
          if (entries++) bytes++;
          if (!addString(key)) return false;
          bytes++;
          children.push(descriptor.value);
        }
      }
      for (let index = children.length - 1; index >= 0; index--) stack.push({ value: children[index] });
    } else return false;
    if (bytes > maximum) return false;
  }
  return true;
}

function scope(value: unknown, strict: boolean, strictLocator = strict): LingvaGuardedApprovalScope | null {
  if (!object(value) || (strict && !only(value, SCOPE_FIELDS))) return null;
  const projectId = data(value, 'projectId'),
    environment = data(value, 'environment'),
    locator = data(value, 'locator');
  if (
    !string(projectId, 200) ||
    !string(environment, 100) ||
    !/^[a-z0-9][a-z0-9-]*$/.test(environment) ||
    !object(locator) ||
    (strictLocator && !only(locator, LOCATOR_FIELDS))
  )
    return null;
  const variantDescriptor = Object.getOwnPropertyDescriptor(locator, 'variantId');
  if (variantDescriptor && (!variantDescriptor.enumerable || !Object.hasOwn(variantDescriptor, 'value'))) return null;
  const entityKey = data(locator, 'entityKey'),
    draftId = data(locator, 'draftId');
  const key = data(locator, 'key'),
    locale = data(locator, 'locale'),
    variantId = data(locator, 'variantId');
  if (
    !string(entityKey) ||
    !string(draftId) ||
    !string(key) ||
    !string(locale) ||
    (variantId !== undefined && !string(variantId))
  )
    return null;
  if (entityKey !== ['authoring', environment, locale, key, draftId].map(encodeURIComponent).join('#')) return null;
  return {
    projectId,
    environment,
    locator: { entityKey, draftId, key, locale, ...(variantId !== undefined ? { variantId } : {}) },
  };
}
function sameScope(a: LingvaGuardedApprovalScope, b: LingvaGuardedApprovalScope): boolean {
  return (
    a.projectId === b.projectId &&
    a.environment === b.environment &&
    LOCATOR_FIELDS.every(
      (key) =>
        a.locator[key as keyof LingvaGuardedApprovalLocator] === b.locator[key as keyof LingvaGuardedApprovalLocator]
    )
  );
}

export function createLingvaGuardedApprovalContextPayload(
  input: LingvaGuardedApprovalScope
): LingvaGuardedApprovalContextPayload {
  try {
    const selected = scope(input, true);
    if (selected) {
      const payload = { action: LINGVA_GUARDED_APPROVAL_ACTIONS.context, ...selected };
      if (fitsJson(payload, LINGVA_GUARDED_APPROVAL_REQUEST_MAX_BYTES)) return payload;
    }
  } catch {
    /* Invalid caller data never escapes through diagnostics. */
  }
  throw new TypeError(INVALID_REQUEST);
}
export function createLingvaGuardedApprovalPayload(input: LingvaGuardedApprovalCommand): LingvaGuardedApprovalPayload {
  try {
    if (object(input) && only(input, [...SCOPE_FIELDS, 'contextToken', 'operationId'])) {
      const selected = scope(input, false, true),
        contextToken = data(input, 'contextToken'),
        operationId = data(input, 'operationId');
      if (selected && token(contextToken) && uuid(operationId)) {
        const payload: LingvaGuardedApprovalPayload = {
          action: LINGVA_GUARDED_APPROVAL_ACTIONS.approve,
          command: APPROVE_COMMAND,
          ...selected,
          contextToken,
          operationId,
        };
        if (fitsJson(payload, LINGVA_GUARDED_APPROVAL_REQUEST_MAX_BYTES)) return payload;
      }
    }
  } catch {
    /* Static failure only; no caller values. */
  }
  throw new TypeError(INVALID_REQUEST);
}

export function parseLingvaGuardedApprovalContextResponse(
  value: unknown,
  expectedScope: LingvaGuardedApprovalScope
): LingvaGuardedApprovalContextResponse | null {
  try {
    if (!fitsJson(value, LINGVA_GUARDED_APPROVAL_RESPONSE_MAX_BYTES) || !object(value) || data(value, 'ok') !== true)
      return null;
    const raw = data(value, 'context'),
      expected = scope(expectedScope, false),
      observed = scope(raw, false);
    if (!object(raw) || !expected || !observed || !sameScope(observed, expected)) return null;
    const actorId = data(raw, 'actorId'),
      contextToken = data(raw, 'contextToken'),
      isCurrent = data(raw, 'isCurrent');
    const draft = data(raw, 'draft'),
      review = data(raw, 'review'),
      baseline = data(raw, 'baseline'),
      permissions = data(raw, 'permissions');
    if (
      !string(actorId) ||
      !token(contextToken) ||
      typeof isCurrent !== 'boolean' ||
      !object(draft) ||
      !object(review) ||
      !object(permissions)
    )
      return null;
    const text = data(draft, 'value'),
      status = data(draft, 'status'),
      authorId = data(draft, 'authorId');
    const approvedBy = data(draft, 'approvedBy'),
      approvedAt = data(draft, 'approvedAt');
    const revision = data(review, 'revision'),
      assigneeId = data(review, 'assigneeId'),
      reviewOutcome = data(review, 'outcome');
    const comment = data(permissions, 'comment'),
      assign = data(permissions, 'assign'),
      decide = data(permissions, 'decide');
    if (
      typeof text !== 'string' ||
      (status !== DRAFT_STATUSES.draft && status !== DRAFT_STATUSES.approved) ||
      (authorId !== undefined && !string(authorId)) ||
      (approvedBy !== undefined && !string(approvedBy)) ||
      (approvedAt !== undefined && !timestamp(approvedAt)) ||
      !integer(revision) ||
      (assigneeId !== undefined && !string(assigneeId)) ||
      (reviewOutcome !== undefined && !outcome(reviewOutcome)) ||
      typeof comment !== 'boolean' ||
      typeof assign !== 'boolean' ||
      typeof decide !== 'boolean' ||
      (!isCurrent && (comment || assign || decide))
    )
      return null;
    let projectedBaseline: LingvaGuardedApprovalContext['baseline'] = null;
    if (baseline !== null) {
      if (!object(baseline)) return null;
      const baseRevision = data(baseline, 'revision'),
        publishId = data(baseline, 'publishId');
      if (!string(baseRevision) || !string(publishId)) return null;
      projectedBaseline = { revision: baseRevision, publishId };
    }
    return {
      ok: true,
      context: {
        ...observed,
        actorId,
        contextToken,
        isCurrent,
        draft: {
          value: text,
          status,
          ...(authorId !== undefined ? { authorId } : {}),
          ...(approvedBy !== undefined ? { approvedBy } : {}),
          ...(approvedAt !== undefined ? { approvedAt } : {}),
        },
        review: {
          revision,
          ...(assigneeId !== undefined ? { assigneeId } : {}),
          ...(reviewOutcome !== undefined ? { outcome: reviewOutcome } : {}),
        },
        baseline: projectedBaseline,
        permissions: { comment, assign, decide },
      },
    };
  } catch {
    return null;
  }
}
export function parseLingvaGuardedApprovalResponse(
  value: unknown,
  expectedOperationId: string
): LingvaGuardedApprovalResponse | null {
  try {
    if (
      !uuid(expectedOperationId) ||
      !fitsJson(value, LINGVA_GUARDED_APPROVAL_RESPONSE_MAX_BYTES) ||
      !object(value) ||
      data(value, 'ok') !== true
    )
      return null;
    const result = data(value, 'result');
    if (!object(result)) return null;
    const operationId = data(result, 'operationId'),
      reviewRevision = data(result, 'reviewRevision');
    const resultOutcome = data(result, 'outcome'),
      approvedAt = data(result, 'approvedAt');
    if (
      operationId !== expectedOperationId ||
      !integer(reviewRevision) ||
      reviewRevision < 1 ||
      resultOutcome !== APPROVAL_OUTCOME ||
      !timestamp(approvedAt)
    )
      return null;
    return {
      ok: true,
      result: { operationId: expectedOperationId, reviewRevision, outcome: APPROVAL_OUTCOME, approvedAt },
    };
  } catch {
    return null;
  }
}
