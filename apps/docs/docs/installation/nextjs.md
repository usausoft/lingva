---
sidebar_position: 4
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Next.js

Lingva's Next.js package is intentionally thin today: it re-exports the React
runtime surface and adds a Next-facing config helper. The recommended App Router
path is to use a Client Component provider at the app boundary and keep private
delivery credentials outside the browser bundle.

## 1. Install packages

<Tabs groupId="package-manager">
  <TabItem value="pnpm" label="pnpm" default>

```bash
pnpm add @lingva/react @lingva/next
pnpm add --save-dev --allow-build @lingva/cli @lingva/cli
```

  </TabItem>
  <TabItem value="yarn" label="yarn">

```bash
yarn add @lingva/react @lingva/next
yarn add --dev @lingva/cli
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm install @lingva/react @lingva/next
npm install --save-dev @lingva/cli
```

  </TabItem>
</Tabs>

## 2. Scaffold local mode

```bash
pnpm lingva init --mode local --no-auth --sdk next
```

This creates:

- `lingva.config.yaml`
- `.lingva/generated/runtime.ts`
- `.lingva/translations/{locale}.json`
- `.lingva/generated/project.ts`
- `src/lingva/provider.tsx`

The generated provider passes a per-provider config and project, so app code
does not need to import every translation file. Keep shared SSR processes free
of request-specific global configuration.

If you want to inspect a working App Router project first, use the
**[Next.js Starter](/installation/next-starter)** in `examples/next-starter`.

## 3. Configure Next.js

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@lingva/core', '@lingva/react', '@lingva/next'],
};

module.exports = nextConfig;
```

## 4. Mount the provider

The generated provider uses `configureLingvaNextClient` or the equivalent React
bootstrap pattern under the hood. A compact manual provider looks like this:

```tsx
// src/lingva/provider.tsx
'use client';

import type { ReactNode } from 'react';
import { createLingvaNextProvider } from '@lingva/next';
import lingvaConfig from '../../.lingva/generated/runtime';
import lingvaProject from '../../.lingva/generated/project';

export const AppLingvaProvider = createLingvaNextProvider({
  config: lingvaConfig,
  project: lingvaProject,
  displayName: 'AppLingvaProvider',
});
```

Mount it once at the app boundary:

```tsx
// app/layout.tsx
import type { ReactNode } from 'react';
import { AppLingvaProvider } from '../src/lingva/provider';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppLingvaProvider>{children}</AppLingvaProvider>
      </body>
    </html>
  );
}
```

## 5. Use translations in Client Components

```tsx
'use client';

import { LingvaText, useLocale, useTranslation } from '@lingva/next';

export function Hero() {
  const { locale, setLocale } = useLocale();
  const { t } = useTranslation();

  return (
    <section>
      <p>{t('home.eyebrow')}</p>
      <h1>
        <LingvaText keyName="home.title" />
      </h1>
      <button onClick={() => setLocale(locale === 'en' ? 'ru' : 'en')}>{t('actions.switchLocale')}</button>
    </section>
  );
}
```

## 6. Keep translations healthy

Run these commands locally and in CI:

```bash
pnpm lingva sync
pnpm lingva check
```

`sync` aligns locale JSON with the default locale; the generated project imports
those JSON files. It does not regenerate TypeScript modules. `check`
fails when non-default locales drift from the default key contract.

## Remote Mode

Remote delivery should not expose private API keys through `NEXT_PUBLIC_*`
environment variables. Use one of these patterns:

- Public, read-only delivery configuration for browser-side CDN loading.
- A Next.js route handler that attaches private credentials server-side.
- Hosted publish/push from CI using `LINGVA_API_KEY` or stored `lingva auth`
  credentials.

For hosted publishing from a developer machine, copy the login command and
publish URL from **Consumer application setup** at
`/app/projects/<project-id>`:

```bash
pnpm lingva auth login
# Stage: pnpm lingva auth login --platform-url https://stage.lingva.dev
pnpm lingva check
pnpm lingva push \
  --api-url "<copy publish URL from Lingva>" \
  --invalidate
```

`pnpm lingva pull --api-url "<copy publish URL from Lingva>"` downloads hosted
translations and merges them with local locale files. Same-key conflicts fail
before writes. Verify protected delivery with a `delivery:read` SDK key; never
expose a publishing credential to Client Components.

## Current Scope

`@lingva/next` currently exports `defineLingvaNextConfig`,
`configureLingvaNextClient`, `createLingvaNextProvider`, React provider/hooks,
`LingvaText`, and core Lingva types. Dedicated Server Component helpers are
planned, but not part of the current package surface yet.
