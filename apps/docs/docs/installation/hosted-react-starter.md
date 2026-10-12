---
sidebar_position: 4
---

# Hosted React Starter

The hosted React starter is the first end-to-end product template for trying Lingva as a real workflow:

1. author translations locally
2. validate with `lingva check`
3. sign in with `lingva auth login`
4. push bundles to hosted delivery
5. manage project access from the dashboard

## Scaffold The Integration

Run the automatic setup in the root of the customer-owned React application:

```bash
pnpm add @lingva/react
lingva auth login
lingva init --sdk react
lingva check
```

`lingva init` discovers the signed-in user's projects and prompts only when the
choice is ambiguous. Open the selected project at `/app/projects/<project-id>`
to review the generated values and create a read-only delivery key when the
application uses hosted runtime delivery.

## Verify Local State

```bash
lingva check
```

The starter uses `.lingva/translations/{locale}.json` and keeps
`lingva.config.ts` as its typed React runtime config. Portable and
non-JavaScript projects use `lingva.config.yaml` instead; do not duplicate the
same settings in both formats in one directory.

## Sign In For Hosted Commands

Copy the CLI login command from **Consumer application setup**. The CLI
discovers the environment's public OAuth metadata from the platform:

```bash
lingva auth login
# Stage: lingva auth login --platform-url https://stage.lingva.dev
```

For local developer machines, prefer browser login over service tokens. Service tokens should stay reserved for CI and server-only dashboard routes.

## Push Hosted Delivery

```bash
lingva push \
  --output-dir .lingva/artifacts/push \
  --api-url "<copy publish URL from Lingva>" \
  --invalidate
```

This produces local publish artifacts and sends the same bundles to hosted delivery.

## App Path

After the project exists in the dashboard:

- open `/app/projects/<project-id>` to copy setup values and create a read-only delivery SDK key
- open `/app/settings` to create or revoke project invites
- open `/app/translations` to review and edit translation drafts
- open `/app/delivery` to inspect publish history and delivery operations

## Why This Starter Exists

This template is intentionally small. It avoids fake API-key flows and focuses on the product path we can already verify today: config, typed React runtime, CLI auth, hosted publish, invalidation, and invite management.
