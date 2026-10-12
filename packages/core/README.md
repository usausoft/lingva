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
