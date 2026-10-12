---
sidebar_position: 3
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# React

## Usage

Use `@lingva/react` when you want:

- provider-based locale state
- typed translation hooks
- one React-friendly integration layer over Lingva runtime config

## Get Started

Add `@lingva/react` when you want a provider-based React integration layer over the Lingva runtime.

### 1. Install the package

<Tabs groupId="package-manager">
  <TabItem value="pnpm" label="pnpm" default>

```bash
pnpm add @lingva/react
pnpm add --save-dev --allow-build @lingva/cli @lingva/cli
```

  </TabItem>
  <TabItem value="yarn" label="yarn">

```bash
yarn add @lingva/react
yarn add --dev @lingva/cli
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm install @lingva/react
npm install --save-dev @lingva/cli
```

  </TabItem>
</Tabs>

### 2. Wrap your app with `LingvaProvider`

If you want Lingva to prepare the first wrapper for you:

```bash
pnpm lingva init --mode local --no-auth --sdk react
```

That creates `src/lingva/provider.tsx` with an `AppLingvaProvider`.
It creates portable `lingva.config.yaml`, a typed `.lingva/generated/runtime.ts`,
and, in local mode, `.lingva/generated/project.ts`. The generated provider owns
its config; it does not require a process-global default.

You can still pass a shared runtime config plus the hidden generated project explicitly:

```tsx
// app/providers.tsx (Next.js App Router)
'use client';

import { LingvaProvider } from '@lingva/react';
import lingvaConfig from '../.lingva/generated/runtime';
import project from '../.lingva/generated/project';

export function Providers({ children }: { children: React.ReactNode }) {
  return <LingvaProvider config={{ ...lingvaConfig, project }}>{children}</LingvaProvider>;
}
```

Browser-only apps may use a one-time bootstrap. Do not use this process-global
default for request-specific SSR projects, credentials, or locales:

```tsx
'use client';

import { configureLingvaReact, LingvaProvider } from '@lingva/react';
import lingvaConfig from '../.lingva/generated/runtime';
import project from '../.lingva/generated/project';

configureLingvaReact({
  ...lingvaConfig,
  project,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <LingvaProvider>{children}</LingvaProvider>;
}
```

You can also use the higher-level runtime props when you want less wiring in app code:

```tsx
'use client';

import { LingvaProvider } from '@lingva/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LingvaProvider
      runtime={{
        mode: 'remote',
        apiUrl: process.env.NEXT_PUBLIC_LINGVA_PUBLISH_API_URL,
        apiKey: process.env.NEXT_PUBLIC_LINGVA_API_KEY,
        projectId: 'website',
        locale: 'en',
        fallbackLocale: 'en',
      }}
    >
      {children}
    </LingvaProvider>
  );
}
```

Copy `NEXT_PUBLIC_LINGVA_PUBLISH_API_URL` and the generated read-only SDK key
from the target environment on the project setup page. The browser key must
have only `delivery:read`; Lingva rejects it for authoring, publishing, or
project administration.

Do not expose project-admin, authoring, or delivery-write keys through
`NEXT_PUBLIC_*` variables. Use `lingva auth login` for interactive CLI writes,
or keep a separately scoped automation key in a server-only environment.

## Advanced

```tsx
// app/layout.tsx
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### 3. Use hooks in components

```tsx
'use client';

import { useLocale, useTranslation } from '@lingva/react';
import type { resources } from '../.lingva/generated/project';

export function Welcome({ name }: { name: string }) {
  const { t } = useTranslation<typeof resources>();
  const { locale, setLocale } = useLocale<typeof resources>();

  return (
    <div>
      <h1>{t('welcome.title')}</h1>
      <p>{t('welcome.message', { variables: { name } })}</p>
      <button onClick={() => setLocale(locale === 'en' ? 'ru' : 'en')}>Switch locale</button>
      <small>{locale}</small>
    </div>
  );
}
```

With typed resources, React hooks can autocomplete valid keys and enforce interpolation variables required by each message template.

## Delivery state, text components, and variants

`useTranslation` returns synchronous `t`, `locale`, `setLocale`, `loading`, and
`error`. For hosted delivery, render loading/error states instead of treating
temporary fallback text as a successfully loaded locale:

```tsx
import { LingvaText, useTranslation } from '@lingva/react';

export function Greeting({ name }: { name: string }) {
  const { loading, error } = useTranslation();
  if (loading) return <p>Loading translations…</p>;
  if (error) return <p>Translations unavailable</p>;
  return <LingvaText keyName="welcome.message" variables={{ name }} as="p" />;
}
```

`useLingva` exposes the underlying client, async `t`, synchronous `tSync`,
`deliveryLoading`, and `deliveryError`. `LingvaText` supports `as`, `variables`,
`defaultValue`, and `editable`. For variant-backed keys, choose a variant ID
(`variant="short"`) or metadata selector (`variant={{ tone: 'warm' }}`). Variant
selection is explicit and separate from ICU-style message pluralization. It does
not parse arbitrary rich text.

## Optional in-context editing

```tsx
<LingvaProvider
  config={{ ...lingvaConfig, project }}
  editor={{
    enabled: isDevelopment,
    canSave: true,
    onSave: async (payload) => {
      const response = await fetch('/api/translations/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Draft save failed');
    },
  }}
>
  {children}
</LingvaProvider>
```

The endpoint is application-owned, not installed by the SDK. `onSave` receives
`key`, `locale`, `value`, and optional `variantId`. Your backend must authenticate
the user, enforce project/write permissions, and validate input. `canSave` is a
UI affordance, not authorization. Throw on failed persistence. Saving a draft
does not itself approve, publish, or invalidate hosted translations. Optional
`getStudioUrl` provides a link to your application's translation editor.

That means React apps can share one runtime contract for:

- provider configuration
- translation keys and interpolation types
- consistent locale behavior across components

### React workflow

1. Scaffold `lingva.config.yaml` and `.lingva/generated/runtime.ts` with `lingva init --mode local --no-auth --sdk react`
2. Keep locales declarative in config and let Lingva manage `.lingva/translations/{locale}.json`
3. Run `lingva sync` to align locale JSON; the generated project imports these files
4. Pass the runtime config and generated project to the provider; reserve global defaults for browser-only single-project apps
5. Read translations with `useTranslation()`
6. Read or switch locale with `useLocale()`
