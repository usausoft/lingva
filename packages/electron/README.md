# `@lingva/electron`

Thin Electron-facing adapter over the framework-agnostic Lingva runtime.

```bash
pnpm add @lingva/electron
pnpm add -D @lingva/cli
```

## Local resources

```bash
pnpm lingva init --mode local --no-auth --sdk vanilla
```

Import the generated runtime config and project into an application-owned
module. This example is at the consumer repository root and assumes
`welcome.title` is a configured translation key:

```ts
import { createLingvaElectronRuntime } from '@lingva/electron';
import runtimeConfig from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

const runtime = createLingvaElectronRuntime({ ...runtimeConfig, project });
console.log(runtime.tSync('welcome.title'));
runtime.destroy();
```

In a running application, retain the runtime for its owning window or main
process instead of destroying it immediately. Subscribe to `getSnapshot()`
updates with `subscribe(listener)` and retain the returned unsubscribe function.
Call it and `destroy()` when that owner shuts down. Local generated resources
can be bundled without Node filesystem access.

## Hosted refresh

For distributable applications, prefer a customer-owned authenticated backend
that forwards authorized reads to Lingva. Here `bundleUrlTemplate` is that
backend's URL containing `{locale}`, and `sessionToken` is the application's
user-session credential, not a Lingva administrative or publishing key:

```ts
import { createLingvaElectronRuntime } from '@lingva/electron';

export async function loadTitle(bundleUrlTemplate: string, sessionToken: string, locale: string) {
  const runtime = createLingvaElectronRuntime({
    mode: 'remote',
    projectId: 'desktop-app',
    locale,
    fallbackLocale: 'en',
    remote: {
      url: bundleUrlTemplate,
      headers: { Authorization: `Bearer ${sessionToken}` },
    },
  });
  try {
    await runtime.loadLocale(locale);
    return runtime.tSync('welcome.title');
  } finally {
    runtime.destroy();
  }
}
```

Validate the locale and use an application-controlled URL before calling this
function. Loading errors reject; decide whether to fail or use a packaged
fallback. `setLocale` alone does not download hosted translations.

## Boundaries

`createLingvaElectronRuntime(input)` wraps `createLingvaJsRuntime(input)`; the
package also re-exports that JS factory and its types. It does not install
Electron IPC handlers, configure `contextBridge`, add filesystem loaders, or
provide persistent/offline storage. Own those integrations in the application.

Keep Lingva write/admin credentials on the backend. A key in an Electron main
process or packaged environment is still extractable; moving it out of the
renderer does not make it a server secret. If direct hosted reads are suitable
for your threat model, use only a `delivery:read` key and copy the deployment's
URL and environment from the project setup page. Expose only the required
translated values through a narrow, validated application-owned IPC boundary.

[Read the public documentation](https://docs.lingva.dev/installation/overview).
