# `@lingva/node`

Node.js integration adapter for Lingva localization, including filesystem-backed
local resources and request-scoped locale handling.

```bash
pnpm add @lingva/node
pnpm add -D @lingva/cli
```

## Local resources and request locales

```bash
pnpm lingva init --mode local --no-auth --sdk vanilla
```

With local generated resources, share a read-only project and bind each request's
locale through `AsyncLocalStorage`. This root-level Express example assumes
`express` is installed and `welcome.title` exists in the translation files:

```ts
import express from 'express';
import { createLingvaLocaleContext, createLingvaLocaleMiddleware, createLingvaNodeRuntime } from '@lingva/node';
import runtimeConfig from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

const runtime = createLingvaNodeRuntime({ ...runtimeConfig, project });
const context = createLingvaLocaleContext(runtime);
const supportedLocales: readonly string[] = runtime.getAvailableLocales();
const app = express();

app.use(
  createLingvaLocaleMiddleware({
    context,
    detectLocale: (request) => {
      const locale = request.headers['x-locale'];
      return typeof locale === 'string' && supportedLocales.includes(locale) ? locale : project.defaultLocale;
    },
  })
);
app.get('/', (_request, response) => {
  response.send(context.tSync('welcome.title'));
});
app.listen(3000);
```

For non-middleware entrypoints, use `context.run(locale, async () => { ... })`
and translate with `context.tSync`. `context.locale()` reports the current async
context's locale, falling back to the runtime's locale. The middleware's default
detector takes only the first `Accept-Language` tag; it does not negotiate or
validate supported locales. Supply a detector like the example when validation
is needed. The middleware has the Connect/Express `(request, response, next)`
signature; other servers need their own adapter.

The locale context isolates locale selection, not credentials, runtime state,
or remote loading. Do not call `runtime.setLocale` or `runtime.loadLocale` on
this shared runtime for individual requests. Destroy it when its application
owner shuts down.

## Filesystem delivery

`createLingvaNodeRuntime` injects a `node:fs/promises` reader for local delivery
paths. The loader accepts JSON translation dictionaries or locale bundles;
relative paths resolve from the process working directory. Without embedded
generated resources, await `runtime.loadLocale(locale)` before synchronous
translation. It does not watch files or regenerate project artifacts.

For lower-level composition, pass `createLingvaNodeFileLoader()` as the
`readFile` loader option to `createLingvaJsRuntime`. Never construct delivery
paths from unvalidated request input.

## Hosted delivery per request

Create a runtime per request when locale loading or credentials differ. Keep the
read-scoped key in server environment variables, validate the requested locale
against your configured locales, and copy the API URL and environment from the
project setup page:

```ts
export async function translateRequestTitle(locale: string) {
  const runtime = createLingvaNodeRuntime({
    mode: 'remote',
    projectId: 'website',
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

Loading failures reject; decide explicitly whether to fail the request or serve
an application-owned fallback. `setLocale` alone does not fetch hosted bundles.
The adapter does not provide durable caching, automatic locale negotiation,
framework-specific server plugins, or hosted write operations.

[Read the public documentation](https://docs.lingva.dev/installation/overview).
