import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createLingvaGuardedApprovalContextPayload as contextPayload,
  createLingvaGuardedApprovalPayload as approvalPayload,
  parseLingvaGuardedApprovalContextResponse as parseContext,
  parseLingvaGuardedApprovalResponse as parseApproval,
} from './guarded-approval';

const scope = {
  projectId: 'project_demo',
  environment: 'dev',
  locator: {
    entityKey: 'authoring#dev#en#hero.title#draft_one',
    draftId: 'draft_one',
    key: 'hero.title',
    locale: 'en',
  },
};
const operationId = '11111111-1111-4111-8111-111111111111';
const contextToken = 'a'.repeat(64);
const command = () => ({ ...scope, contextToken, operationId });
const context = () => ({
  ok: true,
  context: {
    ...scope,
    actorId: 'user_demo',
    contextToken,
    isCurrent: true,
    draft: { value: 'Hello', status: 'draft' },
    review: { revision: 0 },
    baseline: null,
    permissions: { comment: true, assign: false, decide: true },
  },
});
const approval = () => ({
  ok: true,
  result: { operationId, reviewRevision: 1, outcome: 'approved', approvedAt: '2026-10-29T12:00:00.000Z' },
});
const size = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const invalidMessage = 'Invalid guarded approval request.';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('guarded approval request codecs', () => {
  // Wrong selectors, an actor override, generated ID or changed scope breaks these outputs.
  it('builds the context wire without choosing a mutation or default target', () => {
    expect(contextPayload(scope)).toEqual({
      action: 'review-context',
      projectId: 'project_demo',
      environment: 'dev',
      locator: {
        entityKey: 'authoring#dev#en#hero.title#draft_one',
        draftId: 'draft_one',
        key: 'hero.title',
        locale: 'en',
      },
    });
  });
  it('builds only an explicit guarded approve command and preserves the ID', () => {
    expect(approvalPayload(command())).toEqual({
      action: 'review-mutate',
      command: 'approve',
      projectId: 'project_demo',
      environment: 'dev',
      locator: {
        entityKey: 'authoring#dev#en#hero.title#draft_one',
        draftId: 'draft_one',
        key: 'hero.title',
        locale: 'en',
      },
      contextToken: 'a'.repeat(64),
      operationId: '11111111-1111-4111-8111-111111111111',
    });
    const uppercase = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
    expect(approvalPayload({ ...command(), operationId: uppercase }).operationId).toBe(uppercase);
  });
  it('preserves Unicode and variant identities with the exact encoded entity key', () => {
    const value = {
      projectId: 'projet_é',
      environment: 'prod-eu',
      locator: {
        entityKey: 'authoring#prod-eu#fr#h%C3%A9ro.title#draft_one',
        draftId: 'draft_one',
        key: 'héro.title',
        locale: 'fr',
        variantId: 'calme',
      },
    };
    expect(contextPayload(value)).toEqual({ action: 'review-context', ...value });
    const output = contextPayload(Object.freeze({ ...scope, locator: Object.freeze({ ...scope.locator }) }));
    expect(output.locator).not.toBe(scope.locator);
  });
  it.each([
    undefined,
    null,
    [],
    false,
    'synthetic-secret',
    {},
    { ...scope, environment: undefined },
    { ...scope, projectId: undefined },
  ])('rejects malformed or incomplete context input without defaults: %j', (value) => {
    expect(() => contextPayload(value as never)).toThrowError(new TypeError(invalidMessage));
  });
  it.each(['actorId', 'approvedBy', 'authorId', 'roles', 'token', 'url', 'headers', 'text', 'assigneeId', 'action'])(
    'rejects unsupported request %s instead of carrying it through',
    (field) => {
      expect(() => contextPayload({ ...scope, [field]: 'synthetic-secret' } as never)).toThrowError(
        new TypeError(invalidMessage)
      );
      expect(() => approvalPayload({ ...command(), [field]: 'synthetic-secret' } as never)).toThrowError(
        new TypeError(invalidMessage)
      );
    }
  );
  it.each(['', 'Dev', 'dev.eu', ' dev', 'dev ', 'x'.repeat(101)])(
    'rejects invalid explicit environment %s',
    (environment) => {
      expect(() => contextPayload({ ...scope, environment })).toThrowError(new TypeError(invalidMessage));
    }
  );
  it.each(['', ' project_demo', 'project_demo ', 'x'.repeat(201), 5])('rejects malformed project %s', (projectId) => {
    expect(() => contextPayload({ ...scope, projectId } as never)).toThrowError(new TypeError(invalidMessage));
  });
  it.each(['entityKey', 'draftId', 'key', 'locale'])('requires a full matching locator %s', (field) => {
    expect(() => contextPayload({ ...scope, locator: { ...scope.locator, [field]: undefined } } as never)).toThrowError(
      new TypeError(invalidMessage)
    );
    expect(() => contextPayload({ ...scope, locator: { ...scope.locator, [field]: 'different' } })).toThrowError(
      new TypeError(invalidMessage)
    );
  });
  it('rejects empty/unknown variants and locator metadata', () => {
    expect(() => contextPayload({ ...scope, locator: { ...scope.locator, variantId: '' } })).toThrowError(
      new TypeError(invalidMessage)
    );
    expect(() =>
      contextPayload({ ...scope, locator: { ...scope.locator, actorId: 'synthetic-secret' } } as never)
    ).toThrowError(new TypeError(invalidMessage));
  });
  it('rejects unknown approval locator metadata rather than silently stripping request intent', () => {
    expect(() =>
      approvalPayload({ ...command(), locator: { ...scope.locator, actorId: 'synthetic-secret' } } as never)
    ).toThrowError(new TypeError(invalidMessage));
  });
  it('honors project, environment and encoded entity-key boundary lengths', () => {
    const project = { ...scope, projectId: 'p'.repeat(200) };
    expect(contextPayload(project).projectId).toHaveLength(200);
    const environment = 'e'.repeat(100);
    expect(
      contextPayload({
        ...scope,
        environment,
        locator: { ...scope.locator, entityKey: `authoring#${environment}#en#hero.title#draft_one` },
      }).environment
    ).toBe(environment);
    const key = 'k'.repeat(1024 - 'authoring#dev#en##draft_one'.length);
    const value = { ...scope, locator: { ...scope.locator, key, entityKey: `authoring#dev#en#${key}#draft_one` } };
    expect(contextPayload(value).locator.entityKey).toHaveLength(1024);
    expect(() =>
      contextPayload({
        ...value,
        locator: { ...value.locator, key: `${key}k`, entityKey: `authoring#dev#en#${key}k#draft_one` },
      })
    ).toThrowError(new TypeError(invalidMessage));
  });
  it('preserves bounded escaped/multibyte identifiers without a smaller accidental request budget', () => {
    const controls = Math.floor((1024 - 'authoring#dev#en##draft_one'.length) / 3);
    const input = {
      ...command(),
      projectId: '\0'.repeat(200),
      locator: {
        ...scope.locator,
        key: '\0'.repeat(controls),
        entityKey: `authoring#dev#en#${'%00'.repeat(controls)}#draft_one`,
        variantId: '\0'.repeat(1024),
      },
    };
    const output = approvalPayload(input);
    expect(output.projectId).toBe(input.projectId);
    expect(output.locator.variantId).toBe(input.locator.variantId);
    expect(size(output)).toBeGreaterThan(10000);
    expect(size(output)).toBeLessThanOrEqual(16384);
  });
  it.each(['', 'A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), null])('rejects invalid opaque context %s', (token) => {
    expect(() => approvalPayload({ ...command(), contextToken: token } as never)).toThrowError(
      new TypeError(invalidMessage)
    );
  });
  it.each([
    '',
    '11111111-1111-0111-8111-111111111111',
    '11111111-1111-9111-8111-111111111111',
    '11111111-1111-4111-1111-111111111111',
    undefined,
    4,
  ])('requires an explicit supported UUID %s', (id) => {
    expect(() => approvalPayload({ ...command(), operationId: id } as never)).toThrowError(
      new TypeError(invalidMessage)
    );
  });
  it('does not read caller accessors or serialize secret-like hooks', () => {
    let calls = 0;
    const input = { ...scope };
    Object.defineProperty(input, 'projectId', {
      enumerable: true,
      get() {
        calls++;
        throw new Error('synthetic-secret');
      },
    });
    expect(() => contextPayload(input)).toThrowError(new TypeError(invalidMessage));
    expect(calls).toBe(0);
  });
});

describe('guarded variant descriptors', () => {
  it.each(['accessor', 'hidden value', 'hidden accessor'])(
    'rejects a present %s variant instead of changing the selected target',
    (kind) => {
      let calls = 0;
      const locator = { ...scope.locator };
      Object.defineProperty(locator, 'variantId', {
        enumerable: kind === 'accessor',
        ...(kind === 'hidden value'
          ? { value: 'calm' }
          : {
              get() {
                calls++;
                return 'calm';
              },
            }),
      });
      const expected = { ...scope, locator };
      expect(() => contextPayload(expected)).toThrowError(new TypeError(invalidMessage));
      expect(() => approvalPayload({ ...command(), locator })).toThrowError(new TypeError(invalidMessage));
      expect(calls).toBe(0);
    }
  );
  it.each(['accessor', 'hidden value', 'hidden accessor'])(
    'rejects a base-variant response when the expected variant is a present %s',
    (kind) => {
      let calls = 0;
      const locator = { ...scope.locator };
      Object.defineProperty(locator, 'variantId', {
        enumerable: kind === 'accessor',
        ...(kind === 'hidden value'
          ? { value: 'calm' }
          : {
              get() {
                calls++;
                return 'calm';
              },
            }),
      });
      expect(parseContext(context(), { ...scope, locator })).toBeNull();
      expect(calls).toBe(0);
    }
  );
  it('retains ordinary missing or undefined optional variants as the base variant', () => {
    const expected = { ...scope, locator: { ...scope.locator, variantId: undefined } };
    expect(contextPayload(expected)).toEqual({ action: 'review-context', ...scope });
    expect(approvalPayload({ ...command(), locator: expected.locator }).locator).toEqual(scope.locator);
    expect(parseContext(context(), expected)).toEqual(context());
  });
});

describe('guarded context observations', () => {
  // Missing validation, input aliasing or ignored scope differences breaks these cases.
  it('returns a fresh recognized success envelope without authenticating it', () => {
    const input = context();
    const parsed = parseContext(input, scope);
    expect(parsed).toEqual(input);
    expect(parsed).not.toBe(input);
    expect(parsed?.context).not.toBe(input.context);
    expect(parsed?.context.draft).not.toBe(input.context.draft);
    expect(parsed?.context.locator).not.toBe(input.context.locator);
  });
  it('preserves optional facts/content and strips unknown properties at every level', () => {
    const input = {
      ...context(),
      unknown: 'synthetic-secret',
      context: {
        ...context().context,
        unknown: { token: 'synthetic-secret' },
        locator: { ...scope.locator },
        draft: {
          value: '  Hello\n🙂  ',
          status: 'approved',
          authorId: 'user_writer',
          approvedBy: 'user_reviewer',
          approvedAt: '2026-10-29T15:00:00+03:00',
          unknown: 'synthetic-secret',
        },
        review: { revision: 2, assigneeId: 'user_reviewer', outcome: 'approved', unknown: true },
        baseline: { revision: 'revision_one', publishId: 'publish_one', unknown: 'synthetic-secret' },
        permissions: { comment: true, assign: false, decide: true, allow: true },
      },
    };
    expect(parseContext(input, scope)).toEqual({
      ok: true,
      context: {
        ...context().context,
        draft: {
          value: '  Hello\n🙂  ',
          status: 'approved',
          authorId: 'user_writer',
          approvedBy: 'user_reviewer',
          approvedAt: '2026-10-29T15:00:00+03:00',
        },
        review: { revision: 2, assigneeId: 'user_reviewer', outcome: 'approved' },
        baseline: { revision: 'revision_one', publishId: 'publish_one' },
      },
    });
    expect(JSON.stringify(parseContext(input, scope))).not.toMatch(/synthetic-secret|unknown|allow/);
  });
  it('compares locator values independently of property order and retains variant identity', () => {
    const input = context();
    input.context.locator = {
      locale: 'en',
      key: 'hero.title',
      draftId: 'draft_one',
      entityKey: scope.locator.entityKey,
    };
    expect(parseContext(input, scope)).not.toBeNull();
    const expected = { ...scope, locator: { ...scope.locator, variantId: 'calm' } };
    expect(parseContext(input, expected)).toBeNull();
    expect(parseContext({ ...input, context: { ...input.context, locator: expected.locator } }, scope)).toBeNull();
    expect(
      parseContext({ ...input, context: { ...input.context, locator: expected.locator } }, expected)
    ).not.toBeNull();
  });
  it.each([
    undefined,
    null,
    [],
    false,
    {},
    { ok: false },
    { error: 'Authoring action is unsupported.' },
    { ok: true, draftId: 'draft_one', status: 'approved' },
  ])('rejects errors/legacy/missing contexts %j', (value) => {
    expect(parseContext(value, scope)).toBeNull();
  });
  it.each([
    { projectId: 'other_project' },
    { environment: 'prod' },
    { actorId: '' },
    { actorId: ' actor' },
    { contextToken: 'invalid' },
    { isCurrent: 'true' },
    { draft: undefined },
    { review: undefined },
    { baseline: undefined },
    { baseline: { revision: '', publishId: 'publish_one' } },
    { permissions: undefined },
    { draft: { value: 1, status: 'draft' } },
    { draft: { value: 'Hello', status: 'rejected' } },
    { review: { revision: -1 } },
    { review: { revision: 1.5 } },
    { review: { revision: Number.MAX_SAFE_INTEGER + 1 } },
    { review: { revision: 1, outcome: 'other' } },
    { permissions: { comment: true, decide: true } },
    { permissions: { comment: true, assign: false, decide: 'true' } },
  ])('rejects malformed context facts %j without defaulting', (patch) => {
    expect(parseContext({ ok: true, context: { ...context().context, ...patch } }, scope)).toBeNull();
  });
  it('retains a noncurrent all-false observation and rejects contradictory grants', () => {
    const input = {
      ok: true,
      context: {
        ...context().context,
        isCurrent: false,
        permissions: { comment: false, assign: false, decide: false },
      },
    };
    expect(parseContext(input, scope)).toEqual(input);
    expect(
      parseContext(
        { ok: true, context: { ...input.context, permissions: { ...input.context.permissions, decide: true } } },
        scope
      )
    ).toBeNull();
  });
  it.each([
    '2026-02-30T12:00:00Z',
    '2025-02-29T12:00:00Z',
    '2026-10-29T12:00:00',
    '2026-10-29',
    '2026-10-29T24:01:00Z',
    'synthetic-secret',
  ])('rejects invalid/unzoned timestamps %s', (approvedAt) => {
    expect(
      parseContext(
        { ok: true, context: { ...context().context, draft: { value: 'Hello', status: 'approved', approvedAt } } },
        scope
      )
    ).toBeNull();
  });
  it.each(['2024-02-29T12:00:00Z', '2026-10-29T12:00:00.123456789Z', '2026-10-29T15:00:00+03:00'])(
    'preserves valid timestamp %s',
    (approvedAt) => {
      expect(
        parseContext(
          { ok: true, context: { ...context().context, draft: { value: '', status: 'approved', approvedAt } } },
          scope
        )?.context.draft.approvedAt
      ).toBe(approvedAt);
    }
  );
  it.each([
    ['x', 1],
    ['🙂', 4],
    ['\n', 2],
  ] as const)('enforces exact serialized UTF-8 response boundary for %j', (character, cost) => {
    const input = context();
    input.context.draft.value = '';
    const room = 131072 - size(input);
    input.context.draft.value = character.repeat(Math.floor(room / cost)) + 'x'.repeat(room % cost);
    expect(size(input)).toBe(131072);
    expect(parseContext(input, scope)).not.toBeNull();
    input.context.draft.value += 'x';
    expect(parseContext(input, scope)).toBeNull();
  });
  it('counts unknown additive response data before stripping it', () => {
    expect(parseContext({ ...context(), padding: 'x'.repeat(131072) }, scope)).toBeNull();
  });
  it('does not invoke accessors/toJSON or let hooks bypass size enforcement', () => {
    let calls = 0;
    const accessor = context();
    Object.defineProperty(accessor, 'unknown', {
      enumerable: true,
      get() {
        calls++;
        throw new Error('synthetic-secret');
      },
    });
    expect(parseContext(accessor, scope)).toBeNull();
    const oversized = context();
    oversized.context.draft.value = 'x'.repeat(131072);
    Object.defineProperty(oversized, 'toJSON', {
      value() {
        calls++;
        return {};
      },
    });
    expect(parseContext(oversized, scope)).toBeNull();
    expect(calls).toBe(0);
  });
  it('handles cycles/huge arrays without recursion and permits repeated ordinary references', () => {
    const cyclic: Record<string, unknown> = { ...context() };
    cyclic.cycle = cyclic;
    expect(parseContext(cyclic, scope)).toBeNull();
    expect(parseContext({ ...context(), extra: new Array(1_000_000_000) }, scope)).toBeNull();
    const shared = { note: 'synthetic' };
    expect(parseContext({ ...context(), extraA: shared, extraB: shared }, scope)).toEqual(context());
  });
  it('rejects non-data required fields and malformed expected scope without leaking exceptions', () => {
    const input = context();
    Object.defineProperty(input.context, 'actorId', { value: 'user_demo', enumerable: false });
    expect(parseContext(input, scope)).toBeNull();
    expect(parseContext(context(), { ...scope, projectId: ' synthetic-secret ' })).toBeNull();
    expect(parseContext(context(), null as never)).toBeNull();
  });
});

describe('guarded approval acknowledgments', () => {
  it('returns a sanitized approval acknowledgment correlated to the exact captured ID', () => {
    expect(
      parseApproval(
        {
          ...approval(),
          unknown: 'synthetic-secret',
          result: { ...approval().result, actorId: 'not-attested', targetId: 'not-attested' },
        },
        operationId
      )
    ).toEqual(approval());
    const uppercase = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
    expect(
      parseApproval({ ok: true, result: { ...approval().result, operationId: uppercase } }, uppercase)?.result
        .operationId
    ).toBe(uppercase);
    expect(
      parseApproval({ ok: true, result: { ...approval().result, operationId: uppercase } }, uppercase.toLowerCase())
    ).toBeNull();
  });
  it.each([
    { operationId: '22222222-2222-4222-8222-222222222222' },
    { reviewRevision: 0 },
    { reviewRevision: -1 },
    { reviewRevision: Number.MAX_SAFE_INTEGER + 1 },
    { outcome: undefined },
    { outcome: 'rejected' },
    { approvedAt: undefined },
    { approvedAt: '2026-02-30T00:00:00Z' },
  ])('rejects uncorrelated or invalid acknowledgment %j', (patch) => {
    expect(parseApproval({ ok: true, result: { ...approval().result, ...patch } }, operationId)).toBeNull();
  });
  it.each([undefined, null, [], {}, { ok: false }, { ok: true, draftId: 'draft_one', status: 'approved' }])(
    'does not fabricate a receipt from error/legacy data %j',
    (value) => {
      expect(parseApproval(value, operationId)).toBeNull();
    }
  );
  it('validates expected identity and the full acknowledgment byte budget', () => {
    expect(parseApproval(approval(), 'synthetic-secret')).toBeNull();
    expect(parseApproval({ ...approval(), padding: '🙂'.repeat(32768) }, operationId)).toBeNull();
  });
  it('imports and executes with no network, ambient time, random IDs or browser state', async () => {
    const fail = () => {
      throw new Error('unexpected ambient access');
    };
    vi.stubGlobal('fetch', fail);
    vi.stubGlobal('localStorage', { getItem: fail, setItem: fail });
    vi.stubGlobal('crypto', { randomUUID: fail });
    vi.spyOn(Date, 'now').mockImplementation(fail);
    vi.resetModules();
    const codec = await import('./guarded-approval');
    expect(codec.createLingvaGuardedApprovalPayload(command()).operationId).toBe(operationId);
    expect(codec.parseLingvaGuardedApprovalContextResponse(context(), scope)).toEqual(context());
    expect(codec.parseLingvaGuardedApprovalResponse(approval(), operationId)).toEqual(approval());
  });
});
