# Guarded Approval HTTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in bounded core HTTP client for guarded context and exact-command approval recovery.

**Architecture:** A focused transport module reuses existing builders and parsers. One attempt owns its deadline, abort composition, Fetch and bounded byte reader. Existing delivery and authoring owners are unchanged.

**Tech Stack:** TypeScript, standard Fetch/AbortController/ReadableStream, Vitest, Node owned-loopback HTTP, protected package build scripts.

**Spec:** `docs/specs/guarded-approval-http.md`

## Global Constraints

- Native inline execution in the existing isolated SDK worktree; one fresh whole-branch review at the end.
- Default5000ms; optional integer1..5000ms;16KiB credentials;128KiB streamed response. Existing16KiB request codec bound applies.
- No automatic retry, legacy adoption, persistence, server changes, dependency/version/license changes, package publication or hosted calls.
- Public documentation and fixtures are self-contained. Credentials are synthetic; network tests use owned loopback only.

## Review Focus

- Caller/config mutation during deferred credentials must not change the captured wire or validation target (Task1).
- A dependency that ignores abort and settles late must not retain a response reader or create an unhandled rejection (Task1).
- Many empty stream chunks must not starve the application deadline or retain unbounded chunk objects (Task1).
- Errors thrown by dependencies, even public error instances with sensitive text, must not escape sanitized classification (Task1).
- Uncertain acknowledgment followed by denied retries must preserve the original intent until explicit matching success (Task2).

### Task 1: Portable bounded HTTP client

**Files:**
- Create: `packages/core/src/guarded-approval-http.ts`
- Create: `packages/core/src/guarded-approval-http.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes existing guarded scope/command/builders/parsers and response types.
- Produces `createLingvaGuardedApprovalHttpClient(options: LingvaGuardedApprovalHttpOptions): LingvaGuardedApprovalHttpClient`, methods `getContext(scope,options?): Promise<LingvaGuardedApprovalContextResponse>` and `approve(command,options?): Promise<LingvaGuardedApprovalResponse>`.
- Exports error class and named error-kind constants, timeout/token constants, options/client/call-options/kind/phase/recovery types. Error fields are readonly `kind`, `status?`, `phase`, `recovery`.

- [ ] Write tests importing the public index namespace; assert factory/error exports exist, literal POST wire, headers/options, recognized context projection and matching acknowledgment. Test deferred credential/config/caller mutation, input/endpoint/token limits, zero network calls on invalid input and safe errors for every status/classification.
- [ ] Add byte-stream tests: exact128KiB success/one byte over, split multibyte UTF-8, invalid UTF-8/JSON/missing body, wrong full locator/UUID, ignored Content-Length, cancellation and released locks. Add stalled callback/Fetch/body, pre/mid abort, late responses/rejections, empty-chunk deadline, timer/listener cleanup and at most one network call.
- [ ] Run `pnpm --filter @lingva/core test -- src/guarded-approval-http.test.ts`.
  Expected: assertion failure because factory export is missing, not a missing-module error.
- [ ] Implement the interface in the new module. Capture config at factory creation and payload/body before the first await. Use a single application deadline and internal-only failure classification; never trust dependency error text. Check elapsed monotonic time between stream chunks as well as timer abort. Cancel/discard late responses without awaiting unbounded cleanup.
- [ ] Run `pnpm --filter @lingva/core test` and core lint/typecheck.
  Expected: existing250 plus all new tests pass; static gates pass.
- [ ] Commit client, exports, tests, self-contained spec and this plan.
- [ ] Completion command: `pnpm --filter @lingva/core test`.

### Task 2: Real Fetch and packaged-consumer contracts

**Files:**
- Create: `packages/core/src/guarded-approval-http.loopback.test.ts`
- Create: `packages/core/test/guarded-approval-http-consumer.cjs`
- Modify: `packages/core/test/guarded-approval-consumer.types.ts`
- Modify: `scripts/verify-public-packages.mjs`

**Interfaces:**
- Consumes Task1 factory/error/types and unchanged codec scope/command types.
- Produces owned-loopback contract tests and async ESM/CJS/TypeScript package smoke, without an actual server implementation.

- [ ] Write owned-loopback tests for default Fetch POST/header/body, redirect target hit count0, no cookie/credential fallback, stalled body deadline and simulated receipt/lost-ack followed by401/403/409 and explicit identical-command success. Assert one simulated commit, body/UUID equality and no automatic requests. Write packed consumer smoke asserting new exports, both operations and static error fields; add compile-time invalid options/identity override assertions.
- [ ] Run core loopback tests; run new smoke against baseline main built core.
  Expected: loopback tests pass on Task1 behavior; baseline packed smoke fails with missing-export assertion, proving consumer wiring before modification.
- [ ] Wire async HTTP smoke into both packed ESM and CJS entrypoints; preserve existing codec smoke and all11 package checks.
- [ ] Run `pnpm --filter @lingva/core test`, `pnpm build:packages`, `pnpm verify:packages`.
  Expected: all core cases and11 packed consumers including ESM/CJS/TypeScript pass; no registry publication occurs.
- [ ] Commit owned-loopback and consumer contracts.
- [ ] Completion command: `pnpm --filter @lingva/core test`.

### Task 3: Whole-workspace verification and delivery record

**Files:**
- Create: `docs/verification/guarded-approval-http.md`
- Modify: plan checkboxes after observed completion.

**Interfaces:**
- Consumes Task1 client and Task2 test/package contracts.
- Produces dated local verification record with exact counts, limitations and one public candidate PR.

- [ ] Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm test:dependency-security`, `pnpm audit:prod` and inspect results. Run build/packages again only if changes invalidate prior artifacts.
  Expected: workspace gates pass; audit records existing documented patched-artifact exceptions accurately.
- [ ] Verify unchanged legacy codec/authoring/delivery sources, manifests/licenses/dependency pins and original SDK checkout. Record command results and loopback simulation limits.
- [ ] Commit verification record. Completion command: `pnpm --filter @lingva/core test`.
- [ ] Dispatch one fresh whole-branch review after all task gates. Regrade findings by user effect; fix Important/Critical once with genuine regression RED/GREEN and green suite. Ledger minors and every ruling.
- [ ] Refresh private roadmap/project evidence, publish one public SDK PR, attach it and verify its exact head. No successor roadmap PR or SDK merge in this batch.
