# Guarded approval HTTP local verification

29 October2026. Candidate behavior is specified in [the HTTP contract](../specs/guarded-approval-http.md). All credentials and data below are synthetic. Existing callers remain on their existing APIs.

## Observed gates

- Core: 330 tests in 12 files, including 65 injected-Fetch cases, 8 owned-loopback cases and 7 lifecycle regression cases. The250 existing core cases remain green. The missing public factory produced genuine assertion RED before implementation; the old built package produced a missing-export assertion RED before adding packed HTTP consumer coverage.
- `pnpm test`:31 workspace tasks passed. `pnpm lint`:28 tasks plus repository lint passed. `pnpm typecheck`:29 tasks passed.
- `pnpm build:packages`:11 protected public package builds passed. `pnpm verify:packages`:all11 packed consumers passed, including the new guarded HTTP ESM/CJS behavior and TypeScript positive/negative contracts. No registry publication command ran.
- `pnpm test:dependency-security`:23 passed. `pnpm audit:prod` exited0 with the existing two reviewed patched-artifact exceptions (one low, one high). This is not an exception-free audit; see [dependency repair evidence](../specs/workspace-dependency-security.md).
- Legacy codec, authoring and delivery sources, package manifests, lock/workspace files and license files match the branch base (51 preserved files). Original SDK checkout remains clean at its prior revision.

## Transport evidence

Injected tests cover literal guarded wire, captured configuration/intent before deferred credentials, token and endpoint validation, byte ceilings, multibyte boundaries, malformed observations, static failure projection, stalled dependencies, caller abort, late resolution/rejection and reader/timer/listener cleanup. An endless empty-chunk stream terminates through elapsed-time checks without accumulating chunks.

Default Fetch against owned loopback servers sends explicit bearer credentials without cookies. Five redirect statuses301/302/303/307/308 each hit their source once and never reach the destination. A real body stalls after headers and fails within the configured budget. A receipt fixture simulates one commit and lost acknowledgment, then a local invalid-credential attempt and HTTP401/403/409; final explicit credential rotation sends the identical command/UUID and receives the original acknowledgment. There are five network attempts and one simulated commit. No hidden retry occurs.

The receipt fixture is a transport contract simulation, not evidence of any server's authorization or database atomicity. Parsing JWT shape is not identity verification. Cancellation does not establish rollback. Callers retain their captured command until a matching success.

## Delivery boundary

This remains an unpublished opt-in candidate. Package versions, licenses and existing API behavior are unchanged. Server implementation, existing caller adoption, automatic recovery persistence, provider operations and deployment are excluded. One fresh whole-branch review identified four Important lifecycle issues and one interoperability issue, promoted to Important because valid cross-realm byte chunks must work. All five were corrected in one pass with seven assertions observed failing against the original implementation, then passing with the complete 330-case suite. No findings remain deferred.

The corrections replace shared interruption-promise reactions with removable subscriptions, attach rejection handlers before cancellation checks, capture response ownership at fulfillment, make cleanup nonthrowing, and accept cross-realm Uint8Array chunks. A forced-GC subprocess retained all 10,000 empty chunks before the correction; after correction its assertion permits at most two while the next read remains stalled. Other regressions cover synchronous abort during credential/Fetch entry, cancellation immediately after response fulfillment, throwing body/listener cleanup and foreign-realm bytes. Subprocesses load current source with the declared Vite transformer in middleware mode without listening; they do not rebuild shared dist during workspace compilation. Protected package builds and packed consumers run separately.

The final workspace, static, protected-build, packed-consumer, dependency-security and audit gates above were rerun after corrections. Server identity/admission, receipt retention and database atomicity remain outside this client and unproven by these tests. Existing caller adoption and cross-session persistence remain caller-owned; this additive client does not supply them.
