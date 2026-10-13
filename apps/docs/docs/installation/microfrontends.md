---
sidebar_position: 9
---

# Microfrontends

Use one Lingva project as the translation contract while letting every
microfrontend own its runtime. This keeps framework state isolated and avoids
coupling independently deployed applications.

## Recommended layout {#recommended-layout}

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

## Locale propagation {#locale-propagation}

For same-page microfrontends, use an application-owned event whose payload is a
validated Lingva locale. For iframe isolation, pass the locale in the iframe URL
or a typed `postMessage` contract. The child remains responsible for calling
its own adapter's locale-switch method. For vanilla hosted JS, await
`runtime.loadLocale(locale)`: it both selects and loads the locale. Calling
`runtime.setLocale(locale)` afterward creates a new client and discards the loaded
client state. Angular, Vue, and Svelte expose asynchronous `setLocale` methods;
React switches state synchronously and hydrates remote delivery in a provider
effect. Render each adapter's loading and error state. When using `postMessage`,
validate the sender origin and payload, and send to an explicit target origin.

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

## CI verification {#ci-verification}

Run `lingva sync --check` and `lingva check` once against the shared translation
package, then build every consumer. A complete example should also exercise
every independently served application in each supported locale.
