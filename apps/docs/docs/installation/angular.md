---
sidebar_position: 6
---

# Angular

`@lingva/angular` connects the typed Lingva runtime to Angular dependency
injection and signals. It supports local generated resources and remote bundle
delivery through the same configuration contract.

## Remote: recommended setup {#recommended-remote-setup}

Create a project in Lingva first. Install the SDK and CLI, sign in, and select that project:

```bash
pnpm add @lingva/angular @lingva/core
pnpm add -D --allow-build=@lingva/cli @lingva/cli
pnpm lingva auth login
pnpm lingva init --mode remote --sdk angular
pnpm lingva check
```

Init creates `lingva.config.yaml` and `.lingva/generated/runtime.ts` for remote delivery. Create a `delivery:read` SDK key in the project's **Consumer application setup** and wire it into the runtime adapter using your bundler's environment syntax. Keep publishing credentials in the CLI or server environment.

Follow [Remote integration steps](/installation/integration-paths#path-4-hosted-remote-delivery) to prepare and publish translations, then verify bundle loading in your application.

Pass the generated `provideAppLingva()` from `src/lingva/providers.ts` to `bootstrapApplication`. Remote setup does not generate the local `project.ts` used in the fallback examples below.

## Fallback: Local only {#local-only-fallback}

Use the local-resource examples below only when you need repository delivery without a Lingva account. Do not run init over an existing configuration: preserve translations and review changes before switching modes.

## Install {#install}

```bash
pnpm add @lingva/angular @lingva/core
pnpm add -D --allow-build=@lingva/cli @lingva/cli
pnpm lingva init --mode local --no-auth --sdk angular
```

The command generates `src/lingva/providers.ts`. Pass its
`provideAppLingva()` result to `bootstrapApplication`.

## Register the adapter {#register-the-adapter}

Register one adapter at the application boundary. Import the `resources` type
from the generated project to preserve key and interpolation autocomplete.

```ts
// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideLingvaAngular } from '@lingva/angular';
import lingvaConfig from '../.lingva/generated/runtime';
import project from '../.lingva/generated/project';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [provideLingvaAngular({ ...lingvaConfig, project })],
});
```

## Translate in a component {#translate-in-a-component}

```ts
import { Component } from '@angular/core';
import { injectLingva } from '@lingva/angular';
import type { resources } from '../../.lingva/generated/project';

@Component({
  selector: 'app-welcome',
  standalone: true,
  template: `
    <h1>{{ lingva.t('welcome.title') }}</h1>
    <button (click)="setRussian()">Русский</button>
    @if (lingva.loading()) {
      <small>Loading translations…</small>
    }
  `,
})
export class WelcomeComponent {
  readonly lingva = injectLingva<typeof resources>();

  setRussian() {
    void this.lingva.setLocale('ru').catch(() => undefined);
  }
}
```

The adapter exposes read-only `locale`, `loading`, and `error` signals. Locale
loads cancel stale remote requests, so a rapid switch cannot overwrite the most
recent selection. `setLocale` returns a promise that rejects on delivery failure;
this example leaves the failure available through `lingva.error()`. Render that
error signal as well as loading state. The browser adapter's `ready` promise
settles after initial loading and records failures in `error`; it does not reject.
Call `lingva.runtime.destroy()` when its owning application is destroyed.

## Server rendering {#server-rendering}

`createLingvaAngularServer` creates a request-scoped adapter and waits for the
initial remote bundle. Destroy its runtime after the render completes. Do not
reuse an adapter between requests because its locale and signal state are
mutable.

```ts
import { createLingvaAngularServer } from '@lingva/angular';
// This example module lives in src/.
import lingvaConfig from '../.lingva/generated/runtime';
import project from '../.lingva/generated/project';

export async function createRequestLingva(locale: string) {
  return createLingvaAngularServer({ ...lingvaConfig, project, locale });
}
```

If initial delivery fails, the factory rejects instead of rendering a mixture
of fallback and requested-locale content.

For independently deployed Angular applications, see
[Microfrontends](./microfrontends.md).

The repository includes a complete reference at `examples/angular-starter`.
