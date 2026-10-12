---
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Overview

Lingva works best when we keep setup simple:

1. sign in once with `lingva auth login`
2. scaffold the default hosted setup with `lingva init`
3. keep `lingva.config.yaml` as the portable CLI contract; framework scaffolds generate a typed runtime adapter under `.lingva/generated/runtime.ts`. Trusted handwritten `lingva.config.ts` remains an npm-only alternative.
4. use the adapter for your framework, or `@lingva/js` for framework-agnostic code

If you are not sure which setup you need, start with
**[Integration Paths](/installation/integration-paths)**. It separates the
local SDK, React/Next provider, local authoring, hosted remote delivery, and
offline emulator paths.

## Get Started

Install the standalone CLI once. It contains its own runtime; Node.js and
Python are not required. On macOS/Linux, use the public Homebrew tap:

```bash
brew install usausoft/tap/lingva
lingva --version
```

Verify CLI version **0.1.4** or newer for the complete customer command surface.
Homebrew does not install the JavaScript runtime/config bridge. See the
[CLI reference](./cli.md) for differences and upgrade commands.

Direct installers download the checksummed engine from the public npm binary
channel without requiring Node.js or Python:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://unpkg.com/@lingva/cli@latest/lingva-installer.sh | sh
```

Windows PowerShell:

```powershell
irm https://unpkg.com/@lingva/cli@latest/lingva-installer.ps1 | iex
```

Rust developers may install the same binary from crates.io. This route compiles
locally and therefore requires a Rust toolchain; application users should prefer
the prebuilt installer above:

```bash
cargo install lingva
```

Then install only the runtime package used by the application:

<Tabs groupId="package-manager">
  <TabItem value="pnpm" label="pnpm" default>

```bash
pnpm add @lingva/js
```

  </TabItem>
  <TabItem value="yarn" label="yarn">

```bash
yarn add @lingva/js
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm install @lingva/js
```

  </TabItem>
</Tabs>

For Python services, install the published Python runtime:

```bash
python -m pip install "lingva-sdk[http]"
```

See the **[Python guide](./python.md)** for local sync, hosted pull/push, CI hooks,
and runtime bundle loading.

Authenticate and scaffold the project:

```bash
lingva auth login
lingva init
```

Login discovers the OAuth endpoints from `https://lingva.dev` (override with
`--platform-url`). Init defaults to remote mode, discovers accessible projects,
auto-selects the only project, or presents a terminal selection when several
projects are available.

All SDK choices create portable `lingva.config.yaml`. JavaScript choices also
create `.lingva/generated/runtime.ts` and framework adapters. Python uses only
the portable files:

```bash
lingva init --sdk python
```

The same binary creates the portable config without Node.js or Python:

```bash
lingva auth login
lingva init --sdk python
```

If you are starting a React or Next.js app, you can scaffold the first provider wrapper too:

```bash
lingva init --sdk react
lingva init --sdk next
```

That also creates `src/lingva/provider.tsx` with an app-level provider wrapper.

Angular, Vue, and Svelte have framework-native bootstraps as well:

```bash
lingva init --sdk angular
lingva init --sdk vue
lingva init --sdk svelte
```

The interactive setup supports React, Next.js, Angular, Vue, Svelte,
framework-agnostic JavaScript, and Python. Swift, Kotlin, and Flutter
consume the same hosted bundle contract through source-preview SDKs; use the
[native SDK guide](./native-bundles.md) for those packages.

If you want to inspect the scaffold first:

```bash
lingva init --dry-run --format text
```

`--dry-run` lists every config, locale, generated adapter, and CI file without
writing. Existing generated files are protected unless you pass `--force`.

For a fully local, account-free repository, opt out explicitly:

```bash
lingva init --mode local --no-auth --sdk python
```

To scaffold a complete local React integration in an existing application:

```bash
pnpm add @lingva/react
lingva init --mode local --no-auth --sdk react
lingva check
```

For hosted publishing, open `/app/projects/<project-id>` and copy the login and
push commands from **Consumer application setup**. Login discovers public
issuer/client metadata from the selected platform URL.

For a Next.js App Router application:

```bash
pnpm add @lingva/next
lingva init --mode local --no-auth --sdk next
lingva check
```

The public [multi-framework demo](https://github.com/usausoft/lingva-demo)
shows the same translation contract in React, Angular, Vue, Svelte, plain
JavaScript, Swift, Kotlin, and Flutter. Treat it as an implementation reference;
the commands above are the supported setup path for a customer repository.

Minimal runtime example:

```ts
import { createLingvaJsRuntime } from '@lingva/js';
import lingvaConfig from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

const lingva = createLingvaJsRuntime({
  ...lingvaConfig,
  project,
});

console.log(lingva.tSync('common.welcome'));
```

## Current Package Model

| Package              | Description                                                           | When to use                                           |
| -------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- |
| `@lingva/core`       | Typed project, runtime, validation, manifest, and delivery primitives | Tooling and advanced setup                            |
| `@lingva/js`         | Framework-agnostic runtime wrapper                                    | Browser scripts, config-driven surfaces, static sites |
| `@lingva/react`      | Provider and hooks for React                                          | React and Next.js apps                                |
| `@lingva/next`       | Thin adapter over the React runtime                                   | Next.js apps that want a named framework entrypoint   |
| `@lingva/angular`    | Dependency injection, signals, and request-scoped SSR                 | Standalone, module-based, and SSR Angular apps        |
| `@lingva/vue`        | Vue plugin, Composition API, and request-scoped SSR                   | Vue 3 and Nuxt apps                                   |
| `@lingva/svelte`     | Typed stores and request-scoped server helpers                        | Svelte 5 and SvelteKit apps                           |
| `@lingva/docusaurus` | Thin adapter over the JS runtime                                      | Docusaurus sites and docs portals                     |
| `@lingva/electron`   | Thin adapter over the JS runtime                                      | Electron preload and renderer surfaces                |
| `lingva-sdk`         | Python translation runtime (runtime-only from the next 0.1.5 release) | Python backends, workers, and applications            |
| `lingva-cli`         | Separate installer for the Rust customer CLI (next 0.1.4 release)     | Python developer tooling and CI                       |

## Recommended Flow

1. Run `lingva init`
2. Pick `local` or `remote` delivery
3. Keep portable CLI configuration in `lingva.config.yaml`, or typed JavaScript runtime configuration in `lingva.config.ts`
4. Run `lingva sync` for locale JSON alignment; `types` emits separate type artifacts
5. Import the hidden generated project module instead of hand-wiring locale resources
6. Use `createLingvaJsRuntime()`, `LingvaProvider`, or the generated Next provider
7. Let components and scripts work with translations, not manual resource plumbing

For a production application, each path should end with a reproducible check:

- local mode from the config root: `pnpm lingva check`
- React/Next mode: Lingva check plus the app `typecheck` and `build`
- hosted mode: `lingva push --invalidate` plus current-bundle consumption from
  the deployed app environment

## Verification

```ts
import { createLingvaJsRuntime } from '@lingva/js';
import lingvaConfig from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

const lingva = createLingvaJsRuntime({
  ...lingvaConfig,
  project,
});

const value = await lingva.t('test.key', {
  variables: { name: 'Lingva' },
});

console.log(value);
```

## Next Steps

- [Integration Paths](/installation/integration-paths)
- [JavaScript](/installation/js)
- [React](/installation/react)
- [Next.js](/installation/nextjs)
- [Next.js Starter](/installation/next-starter)
- [Hosted React Starter](/installation/hosted-react-starter)
- [Python](/installation/python)
- [Configuration](/installation/configuration)
- [Progress Checklist](/progress)
