# Guarded Approval Codecs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add portable, additive guarded approval request/response codecs to core without changing existing callers.

**Architecture:** One focused module owns types, named selectors, deterministic request builders and sanitized response parsers. A data-only UTF-8 JSON budget check prevents custom serialization hooks from bypassing bounds. The existing public index exports the new surface; package smoke tests exercise the packed result.

**Tech Stack:** Existing TypeScript/Vitest/build-package tooling and portable TextEncoder; no new dependency.

**Spec:** `docs/specs/guarded-approval-contract.md`.

## Global Constraints

- Core only: no HTTP helper, CLI/adapter, server, storage, permission, retention, release or deployment changes.
- Keep legacy actions/types/serializers and release pins unchanged. Add a separate guarded selector/type boundary.
- Request16KiB and response128KiB UTF-8 limits include full JSON data, including unknown response data; never invoke custom toJSON/accessor hooks to determine size.
- Explicit project/environment/full locator; preserve exact identifiers, variant and operation UUID case. Context is opaque64 lowercase hex; UUID versions1–8.
- Return fresh recognized-field projections and null for invalid responses. No missing-fact defaults, actor overrides, fallback, I/O or credential access.
- Public source/spec/fixtures contain public API data only. Keep source-map protection and existing license files unchanged.

## Review Focus

- UTF-8 multibyte and JSON escape boundaries must use serialized byte size, not JavaScript string length.
- Field-order differences, variants and encoded entity keys must not silently cross scope.
- Unknown fields, malformed timestamps and unsafe revisions must not become permission or identity claims.
- Accessor/toJSON/cycle-shaped non-JSON inputs must not execute application serialization hooks or bypass byte limits.
- Packed ESM/CJS/type exports must expose the same additive API while all legacy tests and callers remain unchanged.

---

### Task 1: Implement, test and export the codecs

**Files:** Create `packages/core/src/guarded-approval.ts` and `.test.ts`; modify `packages/core/src/index.ts` with an additive named export block. Extend `scripts/verify-public-packages.mjs` only for guarded-core smoke assertions. Update this spec/plan as completed.

**Interfaces:**

- `LingvaGuardedApprovalLocator`, `LingvaGuardedApprovalScope`, `LingvaGuardedApprovalCommand` describe validated request data.
- `LINGVA_GUARDED_APPROVAL_ACTIONS` contains context=`review-context`, approve=`review-mutate` only; command is fixed `approve`.
- `createLingvaGuardedApprovalContextPayload(scope): LingvaGuardedApprovalContextPayload` and `createLingvaGuardedApprovalPayload(command): LingvaGuardedApprovalPayload` throw the spec's static TypeError on invalid input.
- `parseLingvaGuardedApprovalContextResponse(value:unknown,expectedScope): LingvaGuardedApprovalContextResponse|null` and `parseLingvaGuardedApprovalResponse(value:unknown,expectedOperationId): LingvaGuardedApprovalResponse|null` return full sanitized success envelopes.
- Public context/result types mirror only the spec's fields. Context observation flags never authenticate or authorize anything.

- [x] **Step1: Baseline and failing behavior tests.** Run full core baseline. Write literal payload/context/ack expectations using project `project_demo`, environment `dev`, locator `{entityKey:'authoring#dev#en#hero.title#draft_one',draftId:'draft_one',key:'hero.title',locale:'en'}`, token64`a`, UUID `11111111-1111-4111-8111-111111111111`. Cover every request/response field, limits, scope/variant mismatch, UUID case, known optional fields, additive stripping, exact timestamps/revisions, multibyte bytes/escapes and no ambient access. Tests name the wrong branch/omitted guard/unsafe echo they catch; expectations are literals.
- [x] **Step2: Observe assertion RED.** Export a temporary interface scaffold returning empty payloads/null so tests fail via actual expected-value assertions, not import errors. Run `pnpm --filter @lingva/core test src/guarded-approval.test.ts`; retain failure output. Replace the scaffold only after observing failures.
- [x] **Step3: Minimal implementation.** Validate own JSON data fields and scope; construct known output shapes. Use one internal iterative JSON byte-budget traversal with active-path cycle checks and safe primitive encoding, no toJSON/getter invocation; stop on overflow/non-JSON data. Parsers copy only known validated values and compare scope by fields. Timestamp validation uses deterministic input only. Public constants/types remain separate from legacy authoring.
- [x] **Step4: GREEN and static quality.** Focused/full core tests, core lint/typecheck/build all pass. Test accessor/toJSON and byte-budget mutations through observable outputs. Add root exports; do not edit legacy authoring or client sources. Review changed paths and dependency/lock/license hashes.
- [x] **Step5: Candidate and public export gates.** Extend existing packed ESM/CJS/type smoke with literal guarded context/mutation examples and typed results. Run existing `pnpm build:packages` then `pnpm verify:packages`; install only local candidate tarballs with temporary overrides/ignore-scripts as the existing harness does. Record candidate hashes separately; never publish or commit temporary file overrides. Validate packaging smoke RED against a pre-change candidate when practical; at minimum the codec assertion RED is mandatory and final packed exports must be exercised.
- [x] **Step6: Commit and task completion.** Record actual local results and source hashes; run task-done with the full core test command. Keep any implementation rulings in the ignored plan ledger. No merge or release claim.

## Final review and handoff

Request one fresh whole-branch technical review against the spec/Review Focus and exact base/head. Resolve Important/Critical findings in one RED/GREEN pass; record genuine Minor deferrals. Re-run affected/full gates after source changes. Preserve source-map and public-package boundary checks. Archive the plan's owned ignored scratch, then remove only that scratch after review completion; retain the Git worktree for feedback. Open one SDK PR only, with public scope/validation and no private tracking data. Stop for review; do not merge or publish packages.

## Self-review

One cohesive codec surface owns all requested behavior; no cross-task interfaces. Every contract clause maps to Task1. Public exports are verified from tarballs, and all five Review Focus risks have behavior cases. Native inline execution and one final independent review are the chosen workflow; no additional runtime or generic review feature is implied.
