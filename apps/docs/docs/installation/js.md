---
sidebar_position: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# JavaScript

Use `@lingva/js` when you want Lingva outside React: plain browser code, CLI-side
helpers, build scripts, or site configuration like Docusaurus.

## Get Started

### 1. Install the package

<Tabs groupId="package-manager">
  <TabItem value="pnpm" label="pnpm" default>

```bash
pnpm add @lingva/js
pnpm add --save-dev --allow-build @lingva/cli @lingva/cli
```

  </TabItem>
  <TabItem value="yarn" label="yarn">

```bash
yarn add @lingva/js
yarn add --dev @lingva/cli
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm install @lingva/js
npm install --save-dev @lingva/cli
```

  </TabItem>
</Tabs>

`@lingva/cli` is only an installation adapter for JavaScript projects. Its
`lingva` executable launches the same standalone Rust engine used by direct,
Cargo, and PyPI installs. Package installation fails clearly when the matching
checksummed binary cannot be installed; customer commands never fall back to a
second JavaScript implementation.

### 2. Define project resources

```ts
import { createLingvaResources, defineLingvaProject } from '@lingva/core';

export const resources = createLingvaResources({
  en: {
    welcome: {
      title: 'Welcome to Lingva',
      message: 'Hello, {name}!',
    },
  },
  de: {
    welcome: {
      title: 'Willkommen bei Lingva',
    },
  },
});

export const project = defineLingvaProject({
  projectId: 'website',
  resources,
  defaultLocale: 'en',
  fallbackLocale: 'en',
});
```

### 3. Create a JavaScript runtime

```ts
import { createLingvaJsRuntime } from '@lingva/js';

export const lingva = createLingvaJsRuntime({
  project,
  locale: 'en',
});
```

The same runtime can also start from a higher-level remote setup:

```ts
import { createLingvaJsRuntime } from '@lingva/js';

export const lingva = createLingvaJsRuntime({
  mode: 'remote',
  apiUrl: process.env.LINGVA_PUBLISH_API_URL,
  apiKey: process.env.LINGVA_API_KEY,
  projectId: 'website',
  locale: 'en',
  fallbackLocale: 'en',
});
```

Copy `LINGVA_PUBLISH_API_URL` from the target environment on the project setup
page. Lingva uses a dedicated hosted endpoint for each deployed platform
environment; there is no shared API hostname to guess. For browser code, use
the setup page's `delivery:read` SDK key and your framework's public build-time
environment convention. Never expose a write/admin key in a client bundle.

### 4. Translate strings

```ts
lingva.tSync('welcome.title');
lingva.tSync('welcome.message', {
  variables: { name: 'Lingva' },
});

lingva.setLocale('de');
lingva.tSync('welcome.title');
```

That synchronous example uses the local `project`. Hosted runtimes must load
the locale before synchronous lookups; `setLocale` alone does not fetch:

```ts
await lingva.loadLocale('en');
console.log(lingva.tSync('welcome.title'));
await lingva.loadLocale('de');
lingva.setLocale('de');
console.log(await lingva.t('welcome.title'));
```

Subscribe with `lingva.subscribe(listener)` and retain its returned unsubscribe
function. Unsubscribe and call `lingva.destroy()` when the owning view/request
ends. `preload(keys, locale, { signal })` accepts a caller `AbortSignal`;
`loadLocale(locale)` instead owns cancellation internally and aborts the previous
locale load. Failures appear in runtime state. See the
[configuration reference](./configuration.md) for delivery and cancellation.

## Advanced

`@lingva/js` is also a good fit for config-driven surfaces.

```ts
import { createLingvaJsRuntime } from '@lingva/js';

const runtime = createLingvaJsRuntime({
  project,
  locale: 'en',
});

export const siteText = {
  title: runtime.tSync('welcome.title'),
  locale: runtime.getLocale(),
  locales: runtime.getAvailableLocales(),
};
```

Lingva now supports both flat keys like `'welcome.title'` and nested resource
objects like `welcome: { title: '...' }`. At runtime they resolve to the same
dot-path key contract.

The public documentation uses the same pattern for localized site copy.

When you want to avoid hand-writing the initial config, start with:

```bash
pnpm lingva init --mode local --no-auth --sdk vanilla
```
