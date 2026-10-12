# Lingva Next.js Starter

This starter is the smallest current Next.js path for trying Lingva with App
Router, local translation files, generated project typing, and the
`@lingva/next` provider helper.

It intentionally starts in local mode. Hosted delivery can be added later with
`lingva auth login` and `lingva push --invalidate`.
Run it inside the Lingva repository checkout; its `workspace:*` dependencies
are not a standalone project template. Customer applications should use the
automatic command from **Consumer application setup**.

## What This Exercises

- `lingva.config.ts` as the typed Next.js runtime configuration; portable and non-JavaScript projects use `lingva.config.yaml`
- `.lingva/translations/{locale}.json` local translation files
- `.lingva/generated/project.ts` generated project module
- `createLingvaNextProvider` from `@lingva/next`
- `LingvaText`, `useTranslation`, and `useLocale` in Client Components
- `.lingva/metadata.json` for warning-free key metadata validation
- `lingva sync` and `lingva check` as local verification commands

## Setup

```bash
pnpm install
pnpm verify:starter
pnpm lingva check
pnpm dev
```

If you are starting from a blank Next.js app, the equivalent scaffold command is:

```bash
pnpm lingva init --mode local --no-auth --sdk next
```

## Local Verification

```bash
pnpm verify:starter
pnpm lingva metadata lingva.config.ts --output .lingva/metadata.json
pnpm lingva metadata lingva.config.ts --check
pnpm lingva check
```

`verify:starter` checks the starter file contract and locale key alignment
without touching hosted services.

## Hosted Delivery Later

Copy the hosted settings template and fill it with project-specific values from
**Consumer application setup** at `/app/projects/<project-id>`:

```bash
cp .env.example .env.local
pnpm verify:hosted-env
```

For a no-mutation publish preflight, generate the same artifacts that hosted
delivery will receive:

```bash
pnpm lingva:plan
```

That runs the local `manifest` and `bundle` commands for this starter's `en`
and `ru` locales. It writes artifacts to `.lingva/artifacts/plan` without hosted
requests or locale-file edits. Update the script if you change the locale list.
Do not substitute `push` or a configured `publish`: both can upload remotely.

When hosted delivery is ready, copy the complete login command from the same project setup panel:

```bash
pnpm lingva auth login
# Stage: pnpm lingva auth login --platform-url https://stage.lingva.dev
export LINGVA_PUBLISH_API_URL="<copy publish URL from Lingva>"
pnpm lingva:push
```

The CLI does not automatically load `.env.local`; export the publish URL as
shown or pass it with `--api-url`. To refresh repository translation files from
the current hosted bundles, run `pnpm lingva pull` from this starter directory.

The generated `delivery:read` SDK key may be used by the browser runtime. Keep
authoring, publishing, administration, and service credentials out of
`NEXT_PUBLIC_*` variables; attach private credentials only in a server route.
