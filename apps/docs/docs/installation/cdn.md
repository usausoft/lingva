---
sidebar_position: 7
---

# CDN bundle delivery

Lingva supports loading **translation bundles** from a CDN at runtime. The
SDK packages are public ESM and CommonJS packages on npm. Lingva does not
currently ship a browser-global UMD file for a plain `<script>` tag.

Install `@lingva/js` from npm, then configure a CDN delivery URL:

```ts
import { configureLingvaJs, createLingvaJsRuntime } from '@lingva/js';

configureLingvaJs({
  projectId: 'website',
  environment: 'dev',
  locale: 'en',
  fallbackLocale: 'en',
  apiKey: '<delivery:read SDK key from Consumer application setup>',
  delivery: {
    mode: 'cdn',
    url: 'https://example.lambda-url.eu-west-1.on.aws/bundles/{projectId}/{environment}/latest/{locale}.bundle.json',
  },
});

export const lingva = createLingvaJsRuntime();
await lingva.loadLocale('en');
console.log(lingva.tSync('welcome.title'));
```

Load each hosted locale before synchronous reads. `setLocale` changes selection
but does not fetch in vanilla JS. Use `await lingva.t(...)` for asynchronous
lookup, and destroy the runtime when its owner ends. Process-global
`configureLingvaJs` is suitable only for browser single-project defaults;
server requests should pass explicit config to a request-owned runtime.

Customers should copy the complete bundle URL from **Consumer application
setup** at `/app/projects/<project-id>`; no AWS access or infrastructure output
lookup is required. The delivery endpoint supports these current-bundle routes:

```text
GET {deliveryBaseUrl}/bundles/{projectId}/{environment}/latest/manifest.json
GET {deliveryBaseUrl}/bundles/{projectId}/{environment}/latest/{locale}.bundle.json
```

The URLs are public addresses, but requests are authenticated. The runtime
sends the read-scoped SDK key as `x-api-key`. A browser can inspect that key, so
grant only `delivery:read`; never expose project-administration, authoring, or
publishing credentials. Applications with stricter requirements should proxy
delivery through their authenticated backend.

Ask your workspace administrator to enable your browser origins before
loading bundles from a browser. Native and server consumers are not restricted
by browser CORS. Publishing and invalidation require separate write scopes.

The runtime URL may include the project, environment, locale, and publish
identifiers supported by another delivery endpoint. See
[Configuration](./configuration.md) for cache policies, authentication headers,
and local-versus-CDN behavior.

A standalone browser build can be added later as a separate, tested package
artifact. Until then, use the package-based integration rather than an
unpublished `dist/index.umd.js` URL.

For mobile consumption of the same JSON artifacts, see
[Native bundle consumption](./native-bundles.md).
