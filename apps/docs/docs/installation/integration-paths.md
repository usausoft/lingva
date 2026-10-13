---
sidebar_position: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Integration Paths

Lingva can be adopted gradually. Pick the path that matches how much product
surface you want on day one.

## Path 1: Local SDK Only {#path-1-local-sdk-only}

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

## Path 2: React or Next.js App {#path-2-react-or-nextjs-app}

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

## Path 3: Local Authoring With Review {#path-3-local-authoring-with-review}

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

## Path 4: Hosted Remote Delivery {#path-4-hosted-remote-delivery}

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

### 2. Create an SDK key {#2-create-an-sdk-key}

From the project setup panel, create a project-scoped SDK key. Customer-created
keys have only `delivery:read` scope: they identify browser runtime requests and
support quota/revocation, but cannot author, publish, or administer a project.
Copy the key when it is shown and put it in the consumer application's runtime
environment.

Do not put authoring, publishing, administration, or other write credentials in
`NEXT_PUBLIC_*` variables. Use browser CLI login for human publishing and a
separate server-only automation credential for CI.

### 3. Initialize or update local config {#3-initialize-or-update-local-config}

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

### 4. Authenticate CLI {#4-authenticate-cli}

Prefer browser login for humans. Copy the complete command from **Consumer
application setup**; the issuer URL and client ID are public OAuth metadata, not
secrets:

```bash
pnpm lingva auth login
```

Use service tokens only in CI or server-only routes.

Run login **before** remote init in step 3. To migrate an existing local project,
edit its YAML endpoint/environment and generated runtime delivery settings;
do not rerun init over existing files without reviewing `--force` effects.
The TypeScript block above illustrates runtime fields, not a second root config.
Use your bundler's environment syntax; Vite uses `import.meta.env.VITE_*`, not
`process.env.NEXT_PUBLIC_*`.

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

Browser apps may use a read-scoped SDK key, or consume bundles through an
authenticated server-side proxy. Keep project-admin, authoring, and publishing
keys server-side.

Example runtime (the application must provide the authenticated delivery proxy):

```ts
import { createLingvaJsRuntime } from '@lingva/js';

export const lingva = createLingvaJsRuntime({
  mode: 'remote',
  projectId: 'website',
  locale: 'en',
  fallbackLocale: 'en',
  apiUrl: '/api/lingva/delivery',
});
```

## Choosing The Right Path {#choosing-the-right-path}

| Need                                   | Recommended path            |
| -------------------------------------- | --------------------------- |
| Add typed translations quickly         | Local SDK only              |
| React/Next app with provider and hooks | React or Next.js app        |
| Translator-friendly local review       | Local authoring with review |
| Lingva-hosted source of truth          | Hosted remote delivery      |

## Required Verification Before Shipping {#required-verification-before-shipping}

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

For hosted mode:

```bash
pnpm lingva check
pnpm lingva push \
  --api-url "<publish URL from Lingva>" \
  --invalidate
curl --fail --header "Authorization: Bearer $LINGVA_SDK_KEY" \
  "<bundle URL from Lingva with {locale} replaced>"
```

`lingva pull` downloads hosted bundles and writes only values authored in each
requested locale; resolved fallback values are not copied into that locale.
It requires the `x-lingva-revision` response header and performs a three-way
merge before writing any selected locale. Still verify the deployed read-only
bundle URL after every first environment setup. If any command fails, do not
treat the integration as complete.
