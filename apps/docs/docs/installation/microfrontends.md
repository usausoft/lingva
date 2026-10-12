---
sidebar_position: 9
---

# Microfrontends

Use one Lingva project as the translation contract while letting every
microfrontend own its runtime. This keeps framework state isolated and avoids
coupling independently deployed applications.

## Recommended layout

```text
packages/i18n/
  lingva.config.yaml
  .lingva/generated/runtime.ts
  .lingva/translations/{locale}.json
  .lingva/generated/project.ts
apps/
  shell/
  account-react/
  billing-angular/
  help-vue/
```

Export the generated project from the shared package. Each microfrontend then
creates its own framework adapter from that same project and config.

```ts
import { createLingvaJsRuntime } from '@lingva/js';
import { lingvaConfig, lingvaProject } from '@example/i18n';

export const lingva = createLingvaJsRuntime({
  ...lingvaConfig,
  project: lingvaProject,
});
```

Use the matching package at each framework boundary:

| Framework | Package           | Application boundary            |
| --------- | ----------------- | ------------------------------- |
| React     | `@lingva/react`   | `<LingvaProvider config={...}>` |
| Angular   | `@lingva/angular` | `provideLingvaAngular(...)`     |
| Vue       | `@lingva/vue`     | `app.use(createLingvaVue(...))` |
| Svelte    | `@lingva/svelte`  | `createLingvaSvelte(...)`       |
| Vanilla   | `@lingva/js`      | `createLingvaJsRuntime(...)`    |

All of these adapters use the same generated resource type and runtime delivery
contract. Framework-specific code therefore stays local to each microfrontend
without duplicating locale-loading or cancellation logic.

Do not share a mutable runtime singleton across isolated deployments. Share the
translation contract and propagate the selected locale explicitly instead.

## Locale propagation

For same-page microfrontends, use an application-owned event whose payload is a
validated Lingva locale. For iframe isolation, pass the locale in the iframe URL
or a typed `postMessage` contract. The child remains responsible for calling
its own adapter's `setLocale` method. For vanilla hosted JS, first await
`runtime.loadLocale(locale)` and then call `runtime.setLocale(locale)`; vanilla
locale selection alone does not fetch. Framework adapters handle hydration
inside their asynchronous locale-switch methods.

```ts
const childUrl = new URL('/account/', window.location.origin);
childUrl.searchParams.set('locale', selectedLocale);
iframe.src = childUrl.toString();
```

Treat locale propagation like any other public integration contract:

- reject locales that the child does not support
- keep the fallback locale consistent across applications
- deploy compatible translation keys before code that requires them
- show local loading feedback while a remote locale bundle is fetched

## CI verification

Run `lingva sync --check` and `lingva check` once against the shared translation
package, then build every consumer. A complete example should also exercise
every independently served application in each supported locale.
