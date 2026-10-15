---
sidebar_position: 8
---

# Vue

`@lingva/vue` provides a Vue plugin and Composition API helper backed by the
typed Lingva runtime.

## Remote: recommended setup {#recommended-remote-setup}

Create a project in Lingva first. Install the SDK and CLI, sign in, and select that project:

```bash
pnpm add @lingva/vue @lingva/core
pnpm add -D --allow-build=@lingva/cli @lingva/cli
pnpm lingva auth login
pnpm lingva init --mode remote --sdk vue
pnpm lingva check
```

Init creates `lingva.config.yaml` and `.lingva/generated/runtime.ts` for remote delivery. Create a `delivery:read` SDK key in the project's **Consumer application setup** and wire it into the runtime adapter using your bundler's environment syntax. Keep publishing credentials in the CLI or server environment.

Follow [Remote integration steps](/installation/integration-paths#path-4-hosted-remote-delivery) to prepare and publish translations, then verify bundle loading in your application.

Install the generated `appLingva` plugin from `src/lingva/index.ts` with `app.use(appLingva)`. Remote setup does not generate the local `project.ts` used in the fallback examples below.

## Fallback: Local only {#local-only-fallback}

Use the local-resource examples below only when you need repository delivery without a Lingva account. Do not run init over an existing configuration: preserve translations and review changes before switching modes.

## Install {#install}

```bash
pnpm add @lingva/vue @lingva/core
pnpm add -D --allow-build=@lingva/cli @lingva/cli
pnpm lingva init --mode local --no-auth --sdk vue
```

The command generates `src/lingva/index.ts` with an `appLingva` plugin.

## Install the plugin {#install-the-plugin}

```ts
// src/main.ts
import { createApp } from 'vue';
import { createLingvaVue } from '@lingva/vue';
import lingvaConfig from '../.lingva/generated/runtime';
import project, { type resources } from '../.lingva/generated/project';
import App from './App.vue';

const lingva = createLingvaVue<typeof resources>({
  ...lingvaConfig,
  project,
});

createApp(App).use(lingva).mount('#app');
```

## Use the composable {#use-the-composable}

```vue
<script setup lang="ts">
import { useLingva } from '@lingva/vue';
import type { resources } from '../../.lingva/generated/project';

const { loading, locale, setLocale, t } = useLingva<typeof resources>();
</script>

<template>
  <h1>{{ t('welcome.title') }}</h1>
  <button @click="setLocale('ru')">Русский</button>
  <small v-if="loading">Loading translations…</small>
  <small>{{ locale }}</small>
</template>
```

`locale`, `loading`, and `error` are reactive Vue refs. Use `setLocale`, rather
than assigning the locale ref directly, to trigger delivery. Translation keys and
their variables remain typed from the generated project. Remote locale loads
automatically hydrate bundles and cancel stale requests. `setLocale` returns a
promise that rejects on delivery failure; handle that rejection and render the
`error` ref. The browser plugin's `ready` promise settles after initial loading
and records failures in `error`; it does not reject. Call
`lingva.runtime.destroy()` when its owning application unmounts.

Create one plugin per Vue application. Microfrontends should share the generated
translation contract, not a mutable plugin instance; see
[Microfrontends](./microfrontends.md).

## Nuxt and server rendering {#nuxt-and-server-rendering}

Use `createLingvaVueServer` for remote delivery during SSR. It waits for the
initial locale bundle and throws when delivery fails, allowing Nuxt to handle
the failure before it emits partially translated HTML.

```ts
// plugins/lingva.ts
import { createLingvaVue, createLingvaVueServer } from '@lingva/vue';
import lingvaConfig from '../.lingva/generated/runtime';
import project from '../.lingva/generated/project';

export default defineNuxtPlugin(async (nuxtApp) => {
  const locale = 'en'; // Resolve this from the current request or user session.
  const lingva = import.meta.server
    ? await createLingvaVueServer({ ...lingvaConfig, project, locale })
    : createLingvaVue({ ...lingvaConfig, project, locale });

  nuxtApp.vueApp.use(lingva);
  if (import.meta.server) {
    nuxtApp.hook('app:rendered', () => lingva.runtime.destroy());
  }
});
```

Never export a server adapter singleton. Nuxt can render requests concurrently,
so each request must own its locale, runtime, and cleanup lifecycle.

The runnable reference implementation is available at
`examples/nuxt-starter`.
