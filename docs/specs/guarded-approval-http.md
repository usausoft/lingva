# Guarded approval HTTP client

This opt-in, unpublished core client wraps the [guarded data contract](guarded-approval-contract.md). Existing delivery, authoring and localization APIs stay unchanged. A compatible server must verify actual identity, current admission and receipt ownership. JWT shape validation and response parsing establish none of those facts.

## Interface and configuration

`createLingvaGuardedApprovalHttpClient({endpoint,getBearerToken,fetcher?,timeoutMs?})` returns `getContext(scope,{signal?}?)` and `approve(command,{signal?}?)`. They resolve to the existing context/approval response types. `getBearerToken(signal)` supplies a raw string synchronously or asynchronously. Configuration is captured when the factory runs. Each invocation validates, snapshots and serializes its input before awaiting credentials, without freezing or mutating caller data.

Endpoints are explicit absolute HTTPS URLs, or HTTP with literal `127.0.0.1` or `[::1]` hosts for owned local tests. Reject userinfo, relative URLs, queries and fragments, including empty delimiters. Endpoint and injected Fetch are trusted configuration, not a general SSRF sandbox. There is no hosted default, ambient environment/cookie credential, arbitrary RequestInit, OAuth flow, retry, polling, UUID generation, persistence or legacy fallback.

Send one POST with the exact existing builder payload and explicit Authorization Bearer and JSON content-type headers. Set `redirect:error`, `credentials:omit`, `cache:no-store`, `referrerPolicy:no-referrer`. Reject empty, prefixed, whitespace/control-bearing, non-three-part-base64url or over16KiB UTF-8 token strings locally. Tokens and claims never enter business data, errors or retained client state beyond the active invocation.

## Bounds and observations

Default timeout is5000ms; optional timeout is an integer1..5000ms. One application deadline covers credential acquisition, Fetch and complete body consumption, even if a dependency ignores abort. Caller cancellation composes with it. Dispose timers/listeners and safely cancel/release readers on exit. Cancellation never proves remote rollback.

Read successful bodies as byte streams, with an actual128KiB ceiling independent of Content-Length. Require strict UTF-8 JSON and use the existing parser against captured scope or UUID. Missing bodies, malformed data and mismatches fail. Return a fresh known-field projection, retaining recognized optional fields. Approval success acknowledges only the UUID; captured command supplies its target association. Non-2xx bodies are discarded/canceled and never exposed.

`LingvaGuardedApprovalHttpError` carries static message, `kind`, optional numeric `status`, `phase:local|request`, and `recovery:none|keep-command`. It contains no URL, token, raw exception/cause, server text, scope, subject, translation or command. HTTP400/413 map to invalid-request;401 unauthenticated;403 forbidden;404 not-found;409 conflict;5xx unavailable. Unexpected statuses or malformed successes are invalid-response. Local validation is invalid-request; a throwing credential callback is unavailable; network/cancellation/deadline is transport. Phase becomes request only when Fetch is invoked. All failed approve attempts, including local validation and401/403/409, carry keep-command. Context failures carry none. Factory errors are local/none.

## Intent recovery

The caller owns captured intent and authenticated project/account scope. After any failed approve, retain the same command, UUID and context token. A later explicit invocation may obtain a rotated credential but sends the identical body. Never refresh context, remint a UUID or change target automatically. A locally rejected retry says nothing about an earlier uncertain outcome. Only a valid matching acknowledgment resolves the captured command. No persistence across navigation or session changes is provided.

## Validation and exclusions

Tests use synthetic credentials and injected Fetch, plus owned loopback HTTP servers for default Fetch redirect and receipt-recovery contracts. A loopback receipt simulation is not proof of a real server transaction or database atomicity. Packed ESM/CJS/TypeScript consumers prove exports. No server source, package version/license/dependency change, package publication, existing caller adoption, provider call or deployment belongs to this batch. Removing the additive helper/exports reverses this unpublished candidate.
