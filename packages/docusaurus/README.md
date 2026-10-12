# `@lingva/docusaurus`

Thin Docusaurus-facing adapter over the framework-agnostic Lingva runtime.

```bash
pnpm add @lingva/docusaurus
pnpm add -D @lingva/cli
```

## Local build-time text

```bash
pnpm lingva init --mode local --no-auth --sdk vanilla
```

Use generated resources for build-time labels without a filesystem loader.
This root-level module assumes `welcome.title` is a configured key:

```ts
import { createLingvaDocusaurusRuntime } from '@lingva/docusaurus';
import runtimeConfig from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

const runtime = createLingvaDocusaurusRuntime({ ...runtimeConfig, project });
export const siteTitle = runtime.tSync('welcome.title');
runtime.destroy();
```

Import `siteTitle` into your Docusaurus configuration or a build-time page
generator. A value calculated during the build remains static until rebuilt;
this does not change Docusaurus routes or its own locale negotiation.

## Hosted build-time labels

This function runs in your trusted build process, not browser code. Copy the
deployment API URL, project ID, and environment from Consumer application
setup, and inject a `delivery:read` key through the build's secret store:

```ts
import { createLingvaDocusaurusRuntime } from '@lingva/docusaurus';

export async function loadSiteTitle(locale: string) {
  const runtime = createLingvaDocusaurusRuntime({
    mode: 'remote',
    projectId: 'docs',
    environment: 'production',
    apiUrl: process.env.LINGVA_PUBLISH_API_URL,
    apiKey: process.env.LINGVA_API_KEY,
    locale,
    fallbackLocale: 'en',
  });
  try {
    await runtime.loadLocale(locale);
    return runtime.tSync('welcome.title');
  } finally {
    runtime.destroy();
  }
}
```

Await this function in your build integration and serialize only the translated
text, never the key or runtime config. Validate locales against the site's
configured locale list. A failed load rejects the build integration unless you
explicitly choose a local fallback.

## Runtime and integration boundaries

`createLingvaDocusaurusRuntime(input)` wraps `createLingvaJsRuntime(input)` and
the package re-exports that JS factory and its types. It is not a Docusaurus
plugin: it does not configure presets, generate locale routes, translate
Markdown content automatically, or inject a React provider. Use `@lingva/react`
for reactive page components and Docusaurus's own configuration for routing.

For browser-hosted delivery, await `loadLocale` before synchronous translation,
show loading/errors, and use only a `delivery:read` key or an authenticated
application proxy. Browser keys are inspectable; never ship write/admin keys.
`setLocale` selects a locale but does not fetch it. The thin factory does not
inject a Node filesystem loader; use generated resources or `@lingva/node` when
filesystem delivery is required. Long-lived owners must unsubscribe listeners
and call `destroy()` on cleanup. Keep mutable server runtimes request-scoped.

[Read the public documentation](https://docs.lingva.dev/installation/overview).
