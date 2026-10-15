---
sidebar_position: 7
---

# Svelte

`@lingva/svelte` exposes Lingva locale, loading, and error state as Svelte
stores, with typed translation and locale-switching functions.

## Remote: recommended setup {#recommended-remote-setup}

Create a project in Lingva first. Install the SDK and CLI, sign in, and select that project:

```bash
pnpm add @lingva/svelte @lingva/core
pnpm add -D --allow-build=@lingva/cli @lingva/cli
pnpm lingva auth login
pnpm lingva init --mode remote --sdk svelte
pnpm lingva check
```

Init creates `lingva.config.yaml` and `.lingva/generated/runtime.ts` for remote delivery. Create a `delivery:read` SDK key in the project's **Consumer application setup** and wire it into the runtime adapter using your bundler's environment syntax. Keep publishing credentials in the CLI or server environment.

Follow [Remote integration steps](/installation/integration-paths#path-4-hosted-remote-delivery) to prepare and publish translations, then verify bundle loading in your application.

Use the generated `appLingva` stores from `src/lib/lingva.ts` in browser components. Remote setup does not generate the local `project.ts` used in the fallback examples below. Create separate runtime instances for server requests.

## Fallback: Local only {#local-only-fallback}

Use the local-resource examples below only when you need repository delivery without a Lingva account. Do not run init over an existing configuration: preserve translations and review changes before switching modes.

## Install {#install}

```bash
pnpm add @lingva/svelte @lingva/core
pnpm add -D --allow-build=@lingva/cli @lingva/cli
pnpm lingva init --mode local --no-auth --sdk svelte
```

The command generates `src/lib/lingva.ts` with an `appLingva` store bundle.

## Create the stores {#create-the-stores}

```ts
// src/lib/lingva.ts
import { createLingvaSvelte } from '@lingva/svelte';
import lingvaConfig from '../../.lingva/generated/runtime';
import project, { type resources } from '../../.lingva/generated/project';

export const lingva = createLingvaSvelte<typeof resources>({
  ...lingvaConfig,
  project,
});
```

## Use them in a component {#use-them-in-a-component}

```svelte
<script lang="ts">
  import { lingva } from '$lib/lingva';

  const { loading, locale, setLocale, t } = lingva;
</script>

<h1>{$t('welcome.title')}</h1>
<button onclick={() => setLocale('ru')}>Русский</button>
{#if $loading}<small>Loading translations…</small>{/if}
<small>{$locale}</small>
```

Each adapter instance owns its runtime and stores. This is suitable for Svelte
applications and client-side SvelteKit modules; do not place a user-specific
mutable instance in a shared server module. Remote loads are cancellable and
surface failures through the `error` store. `setLocale` returns a promise that
rejects on delivery failure; handle the rejection and render the error store.
The browser adapter's `ready` promise settles after initial loading and records
failures in `error`; it does not reject. Destroy the runtime when its owning
application unmounts.

## SvelteKit server rendering {#sveltekit-server-rendering}

Create a runtime inside the request's `load` function. Do not return stores or
runtime functions as page data; translate server-owned content and return only
serializable values.

```ts
// src/routes/+layout.server.ts
import { get } from 'svelte/store';
import { createLingvaSvelteServer } from '@lingva/svelte';
import lingvaConfig from '../../.lingva/generated/runtime';
import project from '../../.lingva/generated/project';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const locale = locals.locale ?? 'en';
  const lingva = await createLingvaSvelteServer({ ...lingvaConfig, project, locale });

  try {
    return {
      locale,
      title: get(lingva.t)('welcome.title'),
    };
  } finally {
    lingva.runtime.destroy();
  }
};
```

The browser should create its own adapter from the serialized locale. This
keeps mutable stores request-scoped on the server and application-scoped in the
browser.

The runnable reference implementation is available at
`examples/sveltekit-starter`.

For independently deployed applications, see
[Microfrontends](./microfrontends.md).

The repository includes a complete reference at `examples/svelte-starter`.
