---
sidebar_position: 5
---

# Next.js Starter

Use it when you want to verify the current Next.js integration path with a real
App Router app before wiring Lingva into your own product.

## Scaffold It

Run these commands in the root of the customer-owned Next.js application:

```bash
pnpm add @lingva/next
lingva init --mode local --no-auth --sdk next
lingva check
```

The command creates the typed config, translations, generated project module,
and provider wrapper without requiring access to the private Lingva source
repository.

## What It Covers

- local-first `lingva.config.ts`
- `.lingva/translations/{locale}.json`
- `.lingva/generated/project.ts`
- `createLingvaNextProvider` from `@lingva/next`
- `LingvaText`, `useTranslation`, and `useLocale`
- `.lingva/metadata.json` for warning-free key metadata validation
- Next.js App Router provider mounting in `app/layout.tsx`
- local verification through `verify:starter` and `lingva check`

## Scaffold Equivalent

For an existing Next.js app, start from:

```bash
pnpm lingva init --mode local --no-auth --sdk next
```

Then mount the generated `AppLingvaProvider` from `src/lingva/provider.tsx` in
your App Router layout.

When you add default-locale keys, refresh metadata before CI:

```bash
pnpm lingva metadata lingva.config.ts --output .lingva/metadata.json
pnpm lingva metadata lingva.config.ts --check
pnpm lingva check
```

## Hosted Delivery Later

The starter intentionally begins in local mode. Once your project is ready for
hosted delivery, open `/app/projects/<project-id>`, copy values from **Consumer
application setup**, and verify that private values are not exposed through
`NEXT_PUBLIC_*`:

```bash
cp .env.example .env.local
pnpm verify:hosted-env
```

Generate a no-mutation publish plan before calling hosted services:

```bash
pnpm lingva:plan
```

The starter script runs local `manifest` and `bundle` commands for `en` and
`ru`, writing artifacts to `.lingva/artifacts/plan` without hosted requests or
locale-file edits. Update the script if you change the locale list. `push` and
`publish` with a configured endpoint are not dry runs.

When hosted delivery is ready, copy the complete login command and publish URL
from that setup panel:

```bash
pnpm lingva auth login
# Stage: pnpm lingva auth login --platform-url https://stage.lingva.dev
export LINGVA_PUBLISH_API_URL="<copy publish URL from Lingva>"
pnpm lingva:push
```

The CLI does not automatically load `.env.local`; export the publish URL as
shown or pass it with `--api-url`. Run `pnpm lingva pull` to refresh the local
translation files from the current hosted bundles.

After publishing, verify the current locale bundle through the environment's
delivery URL with the generated read-scoped SDK key.

The generated `delivery:read` SDK key may be used by the browser runtime. Keep
authoring, publishing, administration, and service credentials server-side; do
not expose those private values through `NEXT_PUBLIC_*` variables.
