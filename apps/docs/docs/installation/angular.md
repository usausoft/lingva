---
sidebar_position: 6
---

# Angular

`@lingva/angular` connects the typed Lingva runtime to Angular dependency
injection and signals. It supports local generated resources and remote bundle
delivery through the same configuration contract.

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
