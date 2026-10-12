---
sidebar_position: 12
---

# Runtime contracts and advanced core usage

Most apps should use a framework adapter or `@lingva/js`. Use `@lingva/core`
directly for explicit project composition, validation, or build-time artifacts.

```bash
pnpm add @lingva/core
```

## Resources, lookup, fallback, and variables

```ts
import { createLingvaResources, defineLingvaProject } from '@lingva/core';

const resources = createLingvaResources({
  en: {
    welcome: 'Hello, {name}!',
    button: [
      { id: 'short', text: 'Save', tone: 'neutral' },
      { id: 'warm', text: 'Save your work', tone: 'warm' },
    ],
  },
  ru: {
    welcome: 'Привет, {name}!',
    button: [
      { id: 'short', text: 'Сохранить', tone: 'neutral' },
      { id: 'warm', text: 'Сохраните изменения', tone: 'warm' },
    ],
  },
});

const project = defineLingvaProject({
  projectId: 'my-app',
  environment: 'dev',
  resources,
  defaultLocale: 'en',
  fallbackLocale: 'en',
});

const client = project.createClient({ locale: 'ru' });
console.log(client.tSync('welcome', { variables: { name: 'Nino' } }));
console.log(client.tSync('button', { variant: 'warm' }));
```

Nested dictionaries and flat dotted keys share the same lookup contract.
Translation leaves are strings or non-empty arrays of variants with unique
`id` and string `text`. Metadata selectors such as `variant: { tone: 'warm' }`
select matching variants; absent matches fall back to the first variant.
Variant selection is explicit and separate from message formatting. The JS/TS
runtime supports ICU-style `select`, `plural`, and `selectordinal` messages,
including exact selectors, nested branches and `#` replacement. For example,
`{count, plural, =0 {No items} one {# item} other {# items}}` selects using
`variables: { count: 2 }` and the runtime locale's `Intl.PluralRules`.
This is not full ICU support: plural offsets and date/number formatting are not
implemented. Do not assume i18next suffix selection or arbitrary HTML/rich-text parsing.

Keep placeholders and variant structure consistent across locales. The runtime
can use fallback content; validation still reports missing/inconsistent authored
content. Use explicit `defaultValue` for application-owned missing-key fallback.
Types improve autocomplete for known literal resources, but dynamically loaded
resources and dynamic keys still need runtime validation.

## Metadata, validation, and workflow

`defineLingvaProject` accepts `keyMetadata`, keyed by flattened translation key.
Metadata can include description, namespace, tags, translator, reviewer and
status (`draft`, `translated`, `reviewed`, `approved`). These fields describe
workflow; they do not grant server permissions.

```ts
import { createLingvaWorkflowSummary, validateLingvaProject, shouldFailLingvaValidation } from '@lingva/core';

const validation = validateLingvaProject(project);
console.log(validation.issues);
const failed = shouldFailLingvaValidation(validation, 'error');
const workflow = createLingvaWorkflowSummary(project);
```

Validation covers key syntax, translation contract/variant drift, blank or
missing translations, and metadata/workflow completeness. Policies select what
fails CI; they do not fix files. The [CLI reference](./cli.md) lists issue codes,
filters and thresholds. Quotas count distinct flattened keys, not characters or
locale copies. Keys are at most 200 ASCII characters, start with a letter/digit,
and use letters, digits, `.`, `_`, `-` with no trailing/consecutive dots.

## Manifests, bundles, and generated code

```ts
import {
  createLingvaProjectManifest,
  createLingvaProjectBundle,
  createLingvaPublishArtifacts,
  formatLingvaProjectTypeScriptModule,
  formatLingvaProjectHelpersModule,
} from '@lingva/core';

const manifest = createLingvaProjectManifest(project);
const bundle = createLingvaProjectBundle(project, { locale: 'ru', includeMetadata: true });
const artifacts = createLingvaPublishArtifacts(project, { locales: ['en', 'ru'] });
const typesSource = formatLingvaProjectTypeScriptModule(manifest);
const helpersSource = formatLingvaProjectHelpersModule(manifest);
```

These APIs return data/source strings; they do not upload, invalidate delivery,
or persist files. Manifests describe keys, variables and locale presence. Versioned
bundles include resolved messages, variants, metadata and fallback provenance.
Type/helper generation does not regenerate a framework's runtime scaffold.
For repository operations, use Rust-owned CLI `manifest`, `bundle`, `types`,
`helpers`, `export`, and `import`, rather than implementing a second CLI engine.

## Delivery and isolation

`defineLingvaConfig` describes local or CDN runtime delivery. Portable YAML owns
the CLI; generated `.lingva/generated/runtime.ts` adapts it for JS frameworks.
Browser delivery may use a read-only SDK key, never a publishing/admin token.
CDN URLs are authenticated addresses, not anonymous access grants.

Use [JavaScript](./js.md) for subscriptions, async lookup and cancellation;
[CDN delivery](./cdn.md) for memory cache/refresh policy; and
[server adapters](./server-and-site-adapters.md) for request isolation. Native
and Python validation/interpolation parity has explicit limitations in their
guides; sharing a fixture is not a guarantee of identical behavior.
