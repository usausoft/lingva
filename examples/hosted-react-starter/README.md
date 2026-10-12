# Lingva Hosted React Starter

This starter is the smallest product-facing path for trying Lingva with a React app and hosted delivery.
It intentionally starts from local translation files, then pushes the same state to the hosted backend after a developer signs in with `lingva auth login`.
Run it inside the Lingva repository checkout; its `workspace:*` dependencies are not a standalone project template. Customer applications should use the automatic command from **Consumer application setup**.

## What This Exercises

- `lingva.config.ts` as the typed React runtime configuration; portable and non-JavaScript projects use `lingva.config.yaml`
- `.lingva/translations/{locale}.json` local authoring files
- generated project typing from `.lingva/generated/project.ts`
- React provider and hooks from `@lingva/react`
- browser-based CLI auth for hosted write commands
- `lingva check` before publish
- `lingva push --invalidate` for hosted bundle delivery

## Setup

```bash
pnpm install
cp .env.example .env
pnpm lingva auth login
# Stage: pnpm lingva auth login --platform-url https://stage.lingva.dev
pnpm lingva check
pnpm dev
```

Open the project at `/app/projects/<project-id>` and use **Consumer application setup** for the platform URL, publish URL, bundle URL, and read-only SDK key. The CLI discovers public OAuth metadata from the selected platform. It does not automatically load `.env`.

## Publish Hosted Delivery

Copy the publish URL from **Consumer application setup** in the Lingva dashboard.

```bash
pnpm lingva push \
  --output-dir .lingva/artifacts/push \
  --api-url "<copy publish URL from Lingva>" \
  --invalidate
```

The CLI reuses the access token from `lingva auth login`, so local developers do not need to paste service tokens into commands. The project SDK key created by the customer UI has `delivery:read` scope and cannot publish.

## Local Verification

```bash
pnpm verify:starter
pnpm lingva check
```

`verify:starter` checks the starter file contract without touching hosted services.

## Production Notes

- Do not commit `.env`.
- Do not hard-code hosted service tokens in this app.
- Treat invite tokens as one-time secrets.
- Use the dashboard to create/revoke project invites.
