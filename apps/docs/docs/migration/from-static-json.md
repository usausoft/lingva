---
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Migrating from static JSON

This migration uses portable `lingva.config.yaml` as the CLI owner and
`.lingva/generated/runtime.ts` as its JavaScript runtime adapter. Python and
CI use the same YAML with `lingva sync`, `check`, `pull`, and `push`. Existing
handwritten TS configs remain supported by the npm adapter; do not duplicate
equivalent root YAML and TS files.

This guide covers moving an existing project that manages translations as raw
JSON files to Lingva's typed, versioned workflow. The migration has two phases:
**local** (translation files stay in your repo; verify runtime compatibility) and
**hosted** (bundles are published and delivered at runtime, no redeployment
required for translation updates). You can stop after phase 1 — the local
mode is a complete solution.

---

## What changes (and what stays the same) {#what-changes-and-what-stays-the-same}

|                       | Static JSON workflow     | Lingva local mode                                                | Lingva hosted mode                      |
| --------------------- | ------------------------ | ---------------------------------------------------------------- | --------------------------------------- |
| Translation files     | `public/locales/en.json` | `.lingva/translations/en.json`                                   | same + pushed to Lingva                 |
| Key lookup            | string literal, untyped  | TypeScript-typed, autocomplete                                   | same                                    |
| Missing key detection | runtime (or never)       | compile-time for typed key APIs; `lingva check` for locale drift | same                                    |
| Locale switching      | manual state + re-render | `setLocale()` or provider                                        | same                                    |
| Delivery update       | redeploy                 | redeploy                                                         | `lingva push --invalidate`, no redeploy |
| CI check              | none (or custom)         | `lingva check` + `lingva metadata --check`                       | same                                    |

---

## Phase 1: Local migration {#phase-1-local-migration}

Translation files stay in your repository. Review namespace separators,
interpolation syntax, fallback behavior, and plural/rich-text handling before
replacing your lookup function. Lingva does not emulate every i18next/ICU feature.

### Step 1. Install Lingva {#step-1-install-lingva}

<Tabs groupId="package-manager">
  <TabItem value="pnpm" label="pnpm" default>

```bash
pnpm add @lingva/js           # plain JS / non-React apps
# or
pnpm add @lingva/react        # React apps
# or
pnpm add @lingva/next         # Next.js apps

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

### Step 2. Scaffold Lingva {#step-2-scaffold-lingva}

```bash
pnpm lingva init --mode local --no-auth --sdk vanilla --locale en,fr --default-locale en
```

This creates:

```text
lingva.config.yaml            ← portable CLI config
.lingva/generated/runtime.ts ← typed runtime config adapter
.lingva/translations/en.json  ← starter translation file
.lingva/generated/project.ts  ← module importing locale JSON
```

### Step 3. Move your existing JSON files {#step-3-move-your-existing-json-files}

Copy your existing translation files into `.lingva/translations/`. Lingva
expects one file per locale named `{locale}.json`:

```bash
# Example: copying from a common static structure
cp public/locales/en/translation.json .lingva/translations/en.json
cp public/locales/fr/translation.json .lingva/translations/fr.json
```

Lingva uses nested JSON keys by default:

```json
{
  "nav": {
    "home": "Home",
    "about": "About"
  },
  "auth": {
    "signIn": "Sign in"
  }
}
```

Flat keys also work. Keep whatever structure your existing files use — Lingva
only requires that the structure is consistent across locales.

### Step 4. Check `lingva.config.yaml` {#step-4-check-lingvaconfigyaml}

Tell Lingva about your locales:

```yaml
projectId: my-app
environment: dev
locales: [en, fr]
defaultLocale: en
fallbackLocale: en
translationFiles: .lingva/translations/{locale}.json
metadataFile: .lingva/metadata.json
```

The scaffold's generated project imports the locale files selected during init.
If you later add locales, update both YAML and generated runtime/project imports.
Do not rerun `init --force` without reviewing the replacement files.

### Step 5. Check and generate types {#step-5-check-and-generate-types}

```bash
pnpm lingva check
pnpm lingva metadata --output .lingva/metadata.json
pnpm lingva types --output src/generated/lingva-types.ts
```

`check` validates locale structure, translation contracts and workflow metadata.
`types` emits TypeScript key/locale/variable types, not a runtime project module.
The scaffold's project imports JSON, so ordinary translation edits need no
regeneration. Review validation output before removing the old runtime.

### Step 6. Replace runtime usage {#step-6-replace-runtime-usage}

<Tabs groupId="framework">
  <TabItem value="js" label="Plain JS / framework-agnostic" default>

Replace wherever you loaded and looked up JSON:

```ts
// Before
import en from './locales/en.json';
const t = (key: string) => en[key] ?? key;

// After
import { createLingvaJsRuntime } from '@lingva/js';
import lingvaConfig from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

const lingva = createLingvaJsRuntime({ ...lingvaConfig, project });

// Typed — TypeScript will error if 'nav.home' does not exist
lingva.tSync('nav.home');
```

  </TabItem>
  <TabItem value="react" label="React">

Replace your existing provider and `useTranslation` hook:

```tsx
// Before (e.g. react-i18next)
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();

// After
import { useTranslation } from '@lingva/react';
const { t } = useTranslation();
```

Wrap your app once with `LingvaProvider`:

```tsx
import { LingvaProvider } from '@lingva/react';
import lingvaConfig from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

export function App() {
  return (
    <LingvaProvider config={{ ...lingvaConfig, project }}>
      <YourApp />
    </LingvaProvider>
  );
}
```

Choose `--sdk react` in step 2 to generate the provider wrapper. For an existing
project, add the provider manually rather than replacing files with another init:

```bash
pnpm lingva init --mode local --no-auth --sdk react --locale en,fr
```

  </TabItem>
  <TabItem value="next" label="Next.js">

```tsx
// Before (e.g. next-i18next, next-intl)
import { useTranslations } from 'next-intl';
const t = useTranslations('nav');

// After
import { useTranslation } from '@lingva/react';
const { t } = useTranslation();
t('nav.home'); // key includes the namespace prefix
```

Choose the App Router provider during initial scaffolding:

```bash
pnpm lingva init --mode local --no-auth --sdk next --locale en,fr
```

That creates `src/lingva/provider.tsx` with a ready-to-use `AppLingvaProvider`.
Wrap your root `layout.tsx`:

```tsx
import { AppLingvaProvider } from '@/lingva/provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <AppLingvaProvider>{children}</AppLingvaProvider>
      </body>
    </html>
  );
}
```

  </TabItem>
</Tabs>

### Step 7. Add a CI check (optional but recommended) {#step-7-add-a-ci-check-optional-but-recommended}

```bash
pnpm lingva init --mode local --no-auth --sdk vanilla --locale en,fr --ci github
```

Include `--ci github` in the original init command, or add the generated workflow
manually to an existing project. Init refuses existing config without `--force`.
The workflow installs the standalone binary and runs non-mutating `lingva check`.
Metadata is also Rust-owned: add `lingva metadata --check` when scaffolding drift
must fail CI.

### Step 8. Remove the old library {#step-8-remove-the-old-library}

Once your app builds and tests pass with the Lingva runtime, remove the
previous i18n library:

```bash
pnpm remove react-i18next i18next    # or next-i18next, next-intl, etc.
```

---

## Concept mapping {#concept-mapping}

| Old concept                             | Lingva equivalent                                                                                              |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Namespace (`common`, `auth`)            | Key prefix (`common.`, `auth.`)                                                                                |
| `t('auth:signIn')`                      | `t('auth.signIn')`                                                                                             |
| `t('greeting', { name })`               | `t('greeting', { variables: { name } })`                                                                       |
| `changeLanguage('fr')`                  | `setLocale('fr')`                                                                                              |
| `i18n.language`                         | `locale` from `useTranslation()`                                                                               |
| `fallbackLng`                           | `fallbackLocale` in portable config and runtime adapter                                                        |
| Plural suffix `_one` / `_other`         | No automatic suffix selection; select keys/variants explicitly or migrate to JS/TS ICU-style `plural` messages |
| Missing key → key string returned       | Missing key → falls back to `fallbackLocale`, then key                                                         |
| `Trans` component for JSX interpolation | Use `t()` + split on `{placeholder}`, or pass a render function                                                |

---

## Phase 2: Hosted delivery (optional) {#phase-2-hosted-delivery-optional}

After phase 1 is stable, you can switch to hosted delivery. This lets you push
translation updates without redeploying your app.

### 1. Create a Lingva account and project {#1-create-a-lingva-account-and-project}

Open `/app/projects/<project-id>` and find **Consumer application setup**. Copy
the browser-login command shown there. The CLI discovers the environment's
public OAuth metadata from the platform:

```bash
pnpm lingva auth login
# Stage: pnpm lingva auth login --platform-url https://stage.lingva.dev
```

The SDK key created by the customer UI is read-only runtime configuration. It
cannot replace human login for publishing.

### 2. Push translations to Lingva {#2-push-translations-to-lingva}

```bash
pnpm lingva push \
  --api-url "<copy publish URL from Lingva>" \
  --invalidate
```

### 3. Switch delivery mode {#3-switch-delivery-mode}

Update the generated runtime adapter's delivery configuration. Preserve its
existing project identity/locale fields, and set the same environment as CLI push:

```ts
import { defineLingvaConfig } from '@lingva/core';

const env = typeof process !== 'undefined' ? process.env : {};

export default defineLingvaConfig({
  projectId: 'my-app',
  environment: 'dev',
  locales: ['en', 'fr'],
  defaultLocale: 'en',
  locale: 'en',
  fallbackLocale: 'en',
  apiKey: env.NEXT_PUBLIC_LINGVA_API_KEY,
  translationFiles: '.lingva/translations/{locale}.json',
  generatedProjectFile: '.lingva/generated/project.ts',
  delivery: {
    mode: 'cdn',
    url: env.NEXT_PUBLIC_LINGVA_BUNDLE_URL ?? '',
  },
});
```

Set the bundle URL and `delivery:read` SDK key from **Consumer application setup**
on `/app/projects/<project-id>`. Use the bundler's public environment convention
(`NEXT_PUBLIC_*` for Next.js, `import.meta.env.VITE_*` for Vite). Never expose
write/admin credentials. YAML's `apiUrl` selects CLI transfer; runtime delivery
configuration selects browser loading. Keep both on the same environment.

### 4. Publish and invalidate {#4-publish-and-invalidate}

```bash
pnpm lingva push \
  --api-url "<copy publish URL from Lingva>" \
  --invalidate
```

Published translation changes require no app redeployment. Existing clients
see them when their configured delivery cache reloads or the application
explicitly refreshes the client; `push --invalidate` does not update an
already-loaded in-memory client by itself.

---

## Rollback {#rollback}

If you need to revert to the old library at any point before phase 2:

1. `git revert` the Lingva import changes.
2. Reinstall the old library.
3. Remove the portable config, generated runtime imports and CLI CI steps only after restoring the old integration.

There is no server-side state to undo in local mode.

---

## Next steps {#next-steps}

- [Configuration reference](/installation/configuration)
- [Integration paths](/installation/integration-paths)
- [Next.js starter](/installation/next-starter)
- [Hosted React starter](/installation/hosted-react-starter)
