---
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Installation overview

Start with **Remote**, Lingva's recommended delivery mode. Create an account and workspace project, connect your SDK, and deliver published translations to your application. Choose **Local** only for offline delivery or resources that must stay in the repository.

**[Integration paths](/installation/integration-paths)** provides the complete Remote setup and the Local fallback options.

## Get Started {#get-started}

Install the standalone CLI once. It contains its own runtime; Node.js and
Python are not required. On macOS/Linux, use the public Homebrew tap:

```bash
brew install usausoft/tap/lingva
lingva --version
```

Verify CLI version **0.1.5** or newer for the complete customer command surface.
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

## Connect Remote {#connect-remote}

After creating your project, sign in through the CLI and choose **one** SDK for your application:

```bash
lingva auth login
lingva init --mode remote --sdk vanilla
lingva check
```

Replace `vanilla` with `react`, `next`, `angular`, `vue`, `svelte`, or `python`. Install the matching runtime package before using its adapter. Python uses `lingva-sdk[http]`; JavaScript uses the corresponding `@lingva/<framework>` package.

Login discovers OAuth metadata from `https://lingva.dev`; use `--platform-url` for another environment. Init defaults to Remote, discovers accessible projects, and prompts when several projects are available.

Every SDK creates portable `lingva.config.yaml` and translation files. JavaScript choices also create `.lingva/generated/runtime.ts` and a framework adapter, such as `src/lingva/provider.tsx` for React/Next. Remote setup does not generate local `.lingva/generated/project.ts`.

Open `/app/projects/<project-id>` → **Consumer application setup**. Confirm the environment, publish URL, and bundle URL; create a `delivery:read` SDK key and wire it into your runtime adapter. Use your bundler's environment syntax. Keep publishing credentials in the CLI or server environment.

Prepare translations in `.lingva/translations/{locale}.json`, then validate and publish:

```bash
lingva check
lingva push --invalidate
```

Push uses the configured publish endpoint. To override it, copy the URL from the setup panel and pass `--api-url`. Verify that your application loads the published locale using the read-only SDK key.

To preview generated files before writing, run `lingva init --mode remote --sdk vanilla --dry-run --format text` in a fresh project. For existing configuration, review changes manually; do not overwrite working files with `--force`.

## Fallback: Local only {#local-only-fallback}

Use Local when your application needs repository delivery without a Lingva account. For a fresh project, opt out of Remote explicitly:

```bash
lingva init --mode local --no-auth --sdk vanilla
lingva sync
lingva check
```

Select your SDK instead of `vanilla`. Local JavaScript setup generates `.lingva/generated/project.ts` with resource imports. Use that module only for the local examples; Remote uses the generated adapter without a local project import. Preserve translations and review configuration before changing modes.

## Current Package Model {#current-package-model}

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
| `lingva-sdk`         | Python translation runtime (runtime-only since 0.1.5)                 | Python backends, workers, and applications            |
| `lingva-cli`         | Separate installer for the Rust customer CLI (0.1.5)                  | Python developer tooling and CI                       |

## Recommended Flow {#recommended-flow}

1. Create a Lingva project, install the CLI, and sign in.
2. Connect Remote with `lingva init --mode remote --sdk <sdk>`.
3. Keep CLI configuration in `lingva.config.yaml` and use the generated runtime adapter in your application.
4. Configure the read-only SDK key and prepare translations.
5. Run `lingva check`, then `lingva push --invalidate`.
6. Verify bundle delivery in the application and add application typechecking and build checks to CI.

Local remains a fallback: `lingva check` validates repository resources and contracts without hosted publication.

## Verification {#verification}

```ts
import { createLingvaJsRuntime } from '@lingva/js';
import lingvaConfig from './.lingva/generated/runtime';

const lingva = createLingvaJsRuntime({
  ...lingvaConfig,
});

await lingva.loadLocale('en');

const value = await lingva.t('test.key', {
  variables: { name: 'Lingva' },
});

console.log(value);
```

## Next Steps {#next-steps}

- [Integration Paths](/installation/integration-paths)
- [JavaScript](/installation/js)
- [React](/installation/react)
- [Next.js](/installation/nextjs)
- [Hosted React Starter](/installation/hosted-react-starter)
- [Next.js Starter](/installation/next-starter)
- [Python](/installation/python)
- [Configuration](/installation/configuration)
- [Progress Checklist](/progress)
