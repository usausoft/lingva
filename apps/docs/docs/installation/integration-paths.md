---
sidebar_position: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Integration Paths

Start with Remote delivery to manage and publish translations in Lingva. Use the Local alternatives below when you need offline or repository-only delivery.

## Remote: recommended path {#path-4-hosted-remote-delivery}

Use this when you want Lingva to be the source of truth for published bundles
instead of shipping locale files in your app repository.

### 1. Create a project {#1-create-a-project}

Open the Lingva app and create a customer project in `/app/projects`.

The project detail route is `/app/projects/<project-id>`. Open **Consumer
application setup** there; it is the source of the copyable values and commands
used below.

Record:

- project id
- default locale
- target locales
- environment, usually `dev`, `stage`, or `prod`

### 2. Install and authenticate CLI {#4-authenticate-cli}

Prefer browser login for humans. Copy the complete command from **Consumer
application setup**; the issuer URL and client ID are public OAuth metadata, not
secrets:

```bash
pnpm add @lingva/js @lingva/core
pnpm add -D --allow-build=@lingva/cli @lingva/cli
pnpm lingva auth login
```

Use service tokens only in CI or server-only routes.

### 3. Create an SDK key {#2-create-an-sdk-key}

From the project setup panel, create a project-scoped SDK key. Customer-created
keys have only `delivery:read` scope: they identify browser runtime requests and
support quota/revocation, but cannot author, publish, or administer a project.
Copy the key when it is shown and put it in the consumer application's runtime
environment.

Do not put authoring, publishing, administration, or other write credentials in
`NEXT_PUBLIC_*` variables. Use browser CLI login for human publishing and a
separate server-only automation credential for CI.

### 4. Initialize Remote config {#3-initialize-or-update-local-config}

```bash
pnpm lingva init --mode remote \
  --sdk vanilla \
  --project-id "<project-id>" \
  --api-url "<publish URL from Consumer application setup>" \
  --bundle-url "<bundle URL from Consumer application setup>"
```

Remote config should keep private values outside browser bundles:

```ts
import { defineLingvaConfig } from '@lingva/core';

export default defineLingvaConfig({
  projectId: 'website',
  environment: 'dev',
  locale: 'en',
  fallbackLocale: 'en',
  apiKey: process.env.NEXT_PUBLIC_LINGVA_API_KEY,
  delivery: {
    mode: 'cdn',
    url: process.env.NEXT_PUBLIC_LINGVA_BUNDLE_URL_TEMPLATE,
  },
});
```

For an existing project, review and update its configuration and runtime adapter; init is for a fresh setup. Do not overwrite working files with `--force`. The TypeScript block above illustrates runtime fields, not a second root config. Vite uses `import.meta.env.VITE_*` instead of `process.env.NEXT_PUBLIC_*`.

### 5. Push translations {#5-push-translations}

```bash
pnpm lingva check
pnpm lingva push \
  --api-url "<publish URL from Lingva>" \
  --invalidate
```

The CLI stores the human session in `~/.lingva/credentials.json`. It does not
automatically load `.env` or `.env.local`; pass generated values explicitly as
shown, or export them in the shell before running a package script.

### Where each hosted value comes from {#where-each-hosted-value-comes-from}

| Value                        | Where the customer gets it                                                     | Exposure                                   |
| ---------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------ |
| Project ID                   | Project URL and heading at `/app/projects/<project-id>`                        | Public configuration                       |
| Environment                  | Project **Environments** section; start with `dev`                             | Public configuration                       |
| Bundle URL                   | **Consumer application setup** for the selected environment                    | Public read-only URL                       |
| SDK key                      | **Create SDK key**; shown once and scoped to `delivery:read`                   | Browser runtime configuration              |
| Publish API URL              | Generated config and push command in **Consumer application setup**            | Server/CLI configuration; not a credential |
| CLI issuer URL and client ID | Generated login command in **Consumer application setup**                      | Public OAuth metadata                      |
| Human CLI credential         | Created by browser login and stored in `~/.lingva/credentials.json`            | Local private credential                   |
| CI publishing credential     | Provisioned separately by the Lingva operator and saved in the CI secret store | Server-only secret                         |

Run `pnpm lingva pull` to refresh repository locale files from the current
hosted bundles. After push, verify the published locale through the generated
bundle URL with the read-scoped SDK key.

For local artifact inspection before hosted mutation:

```bash
pnpm lingva manifest --output .lingva/artifacts/plan/manifest.json
pnpm lingva bundle --locale en --output .lingva/artifacts/plan/en.bundle.json
```

Repeat `bundle` for each locale. These commands never publish. `publish` uploads
when an endpoint is configured; `--output-dir` does not make it a dry run.

### 6. Consume hosted bundle {#6-consume-hosted-bundle}

Browser applications use the `delivery:read` SDK key. After wiring that key into the generated adapter, load the locale before synchronous translation lookup:

```ts
import { createLingvaJsRuntime } from '@lingva/js';
import lingvaConfig from './.lingva/generated/runtime';

const lingva = createLingvaJsRuntime({ ...lingvaConfig });
await lingva.loadLocale('en');
console.log(lingva.tSync('common.welcome'));
```

Use a key that exists in your published bundle. React, Next.js, and other framework adapters provide their own loading lifecycle. If your application needs a delivery proxy, implement it server-side. Keep project-admin, authoring, and publishing credentials server-side.

## Fallback: Local SDK only {#path-1-local-sdk-only}

Use this when you want typed translations in an app without creating a Lingva
account or using hosted delivery.

### 1. Install packages {#1-install-packages}

<Tabs groupId="package-manager">
  <TabItem value="pnpm" label="pnpm" default>

```bash
pnpm add @lingva/js
pnpm add -D --allow-build=@lingva/cli @lingva/cli
```

  </TabItem>
  <TabItem value="yarn" label="yarn">

```bash
yarn add @lingva/js
yarn add -D @lingva/cli
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm install @lingva/js
npm install --save-dev @lingva/cli
```

  </TabItem>
</Tabs>

### 2. Initialize Lingva {#2-initialize-lingva}

```bash
pnpm lingva init --mode local --no-auth --sdk vanilla
```

Expected files:

```text
lingva.config.yaml
.lingva/generated/runtime.ts
.lingva/translations/en.json
.lingva/generated/project.ts
```

### 3. Edit default locale {#3-edit-default-locale}

Edit the default locale file first:

```text
.lingva/translations/en.json
```

Nested objects and dot-path keys are both supported:

```json
{
  "common": {
    "welcome": "Welcome, {name}."
  }
}
```

### 4. Sync and check {#4-sync-and-check}

```bash
pnpm lingva sync
pnpm lingva check
```

`sync` adds missing keys to non-default locales without overwriting existing
translations. `check` is the CI-safe command that fails when locale contracts
drift.

### 5. Use runtime {#5-use-runtime}

```ts
import { createLingvaJsRuntime } from '@lingva/js';
import lingvaConfig from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

const lingva = createLingvaJsRuntime({
  ...lingvaConfig,
  project,
});

console.log(
  lingva.tSync('common.welcome', {
    variables: { name: 'Nino' },
  })
);
```

## Fallback: Local React or Next.js app {#path-2-react-or-nextjs-app}

Use this when you want a provider, hooks, locale switching, and optional
inline-editing surfaces.

### React {#react}

```bash
pnpm add @lingva/react
pnpm add --save-dev --allow-build=@lingva/cli @lingva/cli
pnpm lingva init --mode local --no-auth --sdk react
pnpm lingva check
```

Mount the generated provider once:

```tsx
import { AppLingvaProvider } from './src/lingva/provider';

export function App() {
  return (
    <AppLingvaProvider>
      <YourRoutes />
    </AppLingvaProvider>
  );
}
```

Use translations:

```tsx
import { LingvaText, useTranslation } from '@lingva/react';

export function Hero() {
  const { t } = useTranslation();

  return (
    <section>
      <h1>
        <LingvaText keyName="home.title" />
      </h1>
      <p>{t('home.subtitle')}</p>
    </section>
  );
}
```

### Next.js App Router {#nextjs-app-router}

```bash
pnpm add @lingva/react @lingva/next
pnpm add --save-dev --allow-build=@lingva/cli @lingva/cli
pnpm lingva init --mode local --no-auth --sdk next
pnpm lingva check
```

Add transpilation only when your Next.js build setup requires dependency
transpilation:

```js
// next.config.js
const nextConfig = {
  transpilePackages: ['@lingva/core', '@lingva/react', '@lingva/next'],
};

module.exports = nextConfig;
```

Mount the generated provider in `app/layout.tsx`:

```tsx
import { AppLingvaProvider } from '../src/lingva/provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppLingvaProvider>{children}</AppLingvaProvider>
      </body>
    </html>
  );
}
```

## Fallback: Local authoring with review {#path-3-local-authoring-with-review}

Use this when translators or product people need a safer local workflow before
hosted delivery is enabled.

Recommended commands:

```bash
pnpm lingva metadata --output .lingva/metadata.json
pnpm lingva studio --output .lingva/studio.html
pnpm lingva sync
pnpm lingva check
```

Add CI guards:

```bash
pnpm lingva init --mode local --no-auth --ci github
```

This creates a GitHub Actions workflow that runs `lingva check` for locale drift
and validation in pull requests. Configure `metadataFile` and add an explicit
`lingva metadata --check` step when metadata scaffolding is also a required gate.
Existing projects should add the workflow manually: `init` refuses an existing
config unless `--force`, which replaces scaffold files.

## Choosing The Right Path {#choosing-the-right-path}

| Need                                      | Recommended path                      |
| ----------------------------------------- | ------------------------------------- |
| New application with managed translations | Remote (recommended)                  |
| React/Next app with provider and hooks    | Remote with the framework SDK         |
| Offline, repository-only delivery         | Fallback: Local SDK only              |
| Offline translation review                | Fallback: Local authoring with review |

## Required Verification Before Shipping {#required-verification-before-shipping}

For hosted mode:

```bash
pnpm lingva check
pnpm lingva push \
  --api-url "<publish URL from Lingva>" \
  --invalidate
curl --fail --header "Authorization: Bearer $LINGVA_SDK_KEY" \
  "<bundle URL from Lingva with {locale} replaced>"
```

For local mode:

```bash
pnpm lingva check
```

For React/Next apps:

```bash
pnpm lingva check
pnpm typecheck
pnpm build
```

`lingva pull` downloads hosted bundles and writes only values authored in each
requested locale; resolved fallback values are not copied into that locale.
It requires the `x-lingva-revision` response header and performs a three-way
merge before writing any selected locale. Still verify the deployed read-only
bundle URL after every first environment setup. If any command fails, do not
treat the integration as complete.
