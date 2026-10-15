---
sidebar_position: 11
---

# Node, Electron, and Docusaurus

These adapters reuse `@lingva/js`; they are not separate translation engines.
Check your installed package version. This guide describes the current source
surface, not proof that every registry version includes it.

## Start with Remote {#start-with-remote}

For a new application, follow the [recommended Remote setup](/installation/integration-paths#path-4-hosted-remote-delivery). Pass the generated remote configuration to your adapter; keep server credentials outside browser builds. The local-resource examples below are a fallback for repository delivery.

## Node.js {#nodejs}

Install the runtime and CLI, then scaffold local JavaScript resources:

```bash
pnpm add @lingva/node @lingva/core
pnpm add -D --allow-build=@lingva/cli @lingva/cli
pnpm lingva init --mode local --no-auth --sdk vanilla
```

Add `welcome.title` to your locale JSON, then create a runtime:

```ts
import { createLingvaLocaleContext, createLingvaNodeRuntime } from '@lingva/node';
import config from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

const runtime = createLingvaNodeRuntime({ ...config, project });
const context = createLingvaLocaleContext(runtime);
const title = await context.run('en', async () => context.tSync('welcome.title'));
runtime.destroy();
```

`createLingvaLocaleContext` uses AsyncLocalStorage to scope locale selection.
It does not isolate a shared mutable client, preload resources, or make
user-specific credentials safe to share. For hosted delivery with request-specific
identity, create a runtime per request, await `loadLocale(locale)`, translate,
and call `destroy()` in `finally`.

`createLingvaLocaleMiddleware` uses the Connect/Express `(request, response,
next)` signature and defaults to detecting the first Accept-Language tag, without
quality-weight negotiation or supported-locale validation. Supply a custom locale
detector when those are required. Other server
frameworks need a wrapper. Supply `detectLocale` to use a validated session
locale. See the [Node package reference](https://github.com/usausoft/lingva/blob/dev/packages/node/README.md)
for a full middleware example.

`createLingvaNodeFileLoader` returns a filesystem reader for local JSON delivery
paths. `createLingvaNodeRuntime` installs it automatically. Use the generated
project for build-time resources, or await a local delivery load before `tSync`.
The filesystem loader is Node-only; do not include it in browser bundles.

## Electron {#electron}

```bash
pnpm add @lingva/electron @lingva/core
```

```ts
import { createLingvaElectronRuntime } from '@lingva/electron';
import config from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

const runtime = createLingvaElectronRuntime({ ...config, project });
const title = runtime.tSync('welcome.title');
runtime.destroy();
```

The factory is a thin alias of the JS runtime. It does not install IPC handlers,
access local files automatically, or persist bundles. Keep privileged credentials
in the main process or an authenticated backend; expose only read-scoped delivery
values to renderer code. For hosted resources, await `loadLocale` before `tSync`.

## Docusaurus {#docusaurus}

```bash
pnpm add @lingva/docusaurus @lingva/core
```

```ts
import { createLingvaDocusaurusRuntime } from '@lingva/docusaurus';
import config from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

const runtime = createLingvaDocusaurusRuntime({ ...config, project });
const siteTitle = runtime.tSync('welcome.title');
runtime.destroy();
```

This is a JS factory, not a Docusaurus plugin. It does not create translated
Markdown, routes, sidebars, locale URL prefixes, or filesystem loading. Configure
Docusaurus i18n separately. Static site builds should use repository resources;
never serialize publishing credentials into generated pages.

## Shared lifecycle and delivery {#shared-lifecycle-and-delivery}

- Synchronous lookup needs embedded or previously loaded resources.
- Hosted loading needs a copied project/environment bundle URL and read-scoped key.
- Vanilla `setLocale` does not fetch: await `loadLocale` when switching hosted locales.
- Unsubscribe listeners and destroy runtimes when their owning request/view ends.
- Share immutable contracts, not request-specific runtime singletons.

See [JavaScript](./js.md), [CDN delivery](./cdn.md), and
[configuration](./configuration.md) for async lookup, caching and authentication.
