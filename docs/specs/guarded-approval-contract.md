# Guarded approval data contract

This additive core contract describes approval context and approval commands. It contains no HTTP client, authentication implementation, storage, automatic retry or legacy approval fallback. Existing authoring contracts remain unchanged. A server must support the guarded actions; this document does not claim that a particular deployment does.

## Requests

A scope has explicit `projectId`, `environment` and `locator`. The locator contains `entityKey`, `draftId`, `key`, `locale` and optional `variantId`. Identifiers are nonempty trimmed strings, preserved exactly. Project is at most200 characters; environment is at most100 and matches `^[a-z0-9][a-z0-9-]*$`; locator strings are at most1024. A supplied variant cannot be empty. The entity key equals the URI-encoded `authoring`, environment, locale, key and draft ID segments joined by `#`.

`createLingvaGuardedApprovalContextPayload(scope)` returns `{action:'review-context',projectId,environment,locator}`.

`createLingvaGuardedApprovalPayload({...scope,contextToken,operationId})` returns `{action:'review-mutate',command:'approve',projectId,environment,locator,contextToken,operationId}`. The context token is opaque lowercase64-hex. The operation ID is a caller-supplied UUID, version1–8, with its exact case preserved. Callers retain one captured command and ID for uncertain-response recovery; a changed context or target is a new intent. The builder never generates an ID or fetches context.

Request inputs allow only the fields described here. Actor overrides, credentials, transport headers, URLs, comments and assignments are not request fields. Invalid input throws `TypeError('Invalid guarded approval request.')` without input values. Serialized requests may not exceed16KiB UTF-8. A rejected guarded request never becomes legacy approval.

## Responses

`parseLingvaGuardedApprovalContextResponse(value,expectedScope)` returns `{ok:true,context}` with a fresh known-field projection, or `null`. Context contains matching scope, server-reported `actorId`, context token, boolean `isCurrent`, and:

- `draft:{value,status,authorId?,approvedBy?,approvedAt?}`, status `draft|approved`;
- `review:{revision,assigneeId?,outcome?}`, nonnegative safe revision, outcome `approved|changes-requested|rejected` when present;
- `baseline:null|{revision,publishId}`;
- `permissions:{comment,assign,decide}`, each boolean. A noncurrent context has no true permission flag.

Required identifiers use the bounded string rules. Timestamp fields represent a finite instant with explicit timezone. Locator equality compares field values, independent of insertion order. Missing facts are not defaulted. Draft content remains exact, including whitespace; validation errors do not include it. Additive unknown response properties are omitted, not promoted into authority. Decoded responses may not exceed128KiB UTF-8.

`parseLingvaGuardedApprovalResponse(value,expectedOperationId)` returns `{ok:true,result}` or `null`. An approval result requires the exact expected UUID string, positive safe `reviewRevision`, `outcome:'approved'` and valid `approvedAt`. No actor/target attestation or fabricated draft record is added. Unsupported/error/malformed responses remain failures.

These parsers describe supplied JSON observations. They do not verify the server, principal, freshness or permissions. A context token is not a bearer credential. An acknowledgment does not promise indefinite receipt retention or an immutable audit archive. Authorization remains a server responsibility, including admission before retry recovery.

## Portability and compatibility

The codecs are portable pure functions without network, environment, random, clock or storage access. Legacy authoring actions and serializers retain their existing behavior. Other review commands, history, assignment, transport helpers, CLI behavior and server mutation logic are outside this contract. Fixtures and package smoke examples use synthetic content only.
