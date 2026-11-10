# `@lingva/core`

Typed runtime contracts and localization primitives shared by every Lingva
integration.

```bash
pnpm add @lingva/core
```

Use this package directly for advanced runtime composition, validation, bundle
generation, or custom framework adapters. Most applications should install
`@lingva/js` or their framework-specific adapter instead.

[Read the public documentation](https://docs.lingva.dev/installation/overview).

See [runtime contracts](https://docs.lingva.dev/installation/runtime-contracts)
for executable project/client, variant, validation, workflow, manifest, bundle
and generated-code examples. Core artifact APIs return data/source strings;
they do not publish or persist files. Repository command behavior belongs to
the Rust CLI, not a second JavaScript implementation.

## Publication audit action

`LINGVA_HOSTED_PROJECT_AUDIT_ACTION.deliveryPublish` has the wire value
`delivery.publish`. The existing action predicate, audit-event normalizer and
`createLingvaHostedProjectAuditEventPayload` recognize it. The target type stays
`delivery`; publication events can use the server publish ID as their target ID.

When adopting a build containing this action, add it to exhaustive action maps
and switches. For example, extend an existing twelve-action label map:

```ts
import { LINGVA_HOSTED_PROJECT_AUDIT_ACTION, type LingvaHostedProjectAuditAction } from '@lingva/core';

const labels: Record<LingvaHostedProjectAuditAction, string> = {
  ...previousLabels,
  [LINGVA_HOSTED_PROJECT_AUDIT_ACTION.deliveryPublish]: 'Published translations',
};
```

This is an additive wire value, but old exhaustive TypeScript maps may require
that source change. Existing audit fields and validation bounds remain the same.
Normalization and request construction produce data; they do not authenticate
an actor or confirm a publication, database commit, artifact availability or
cache purge. The create-request selector stays `createAuditEvent`. SDK
recognition does not grant server admission: servers without support for the
new action can still reject the request. No HTTP call occurs in these helpers.
