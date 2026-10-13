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

## Scaffold The Integration {#scaffold-the-integration}

Run the automatic setup in the root of the customer-owned React application:

```bash
pnpm add @lingva/react
pnpm add -D --allow-build=@lingva/cli @lingva/cli
pnpm lingva auth login
pnpm lingva init --sdk react
pnpm lingva check
```

`lingva init` discovers the signed-in user's projects and prompts only when the
choice is ambiguous. Open the selected project at `/app/projects/<project-id>`
to review the generated values and create a read-only delivery key when the
application uses hosted runtime delivery.

## Verify Local State {#verify-local-state}

```bash
pnpm lingva check
```

The automatic setup above creates portable `lingva.config.yaml` and the typed
React runtime adapter `.lingva/generated/runtime.ts`, with translation files
in `.lingva/translations/{locale}.json`. Keep YAML as the CLI configuration owner.

The repository example in `examples/hosted-react-starter` instead uses a
handwritten `lingva.config.ts` and workspace dependencies. It is an in-repository
implementation reference, not a standalone copy-and-install template. The npm
adapter supports its trusted executable configuration; do not create a duplicate
root YAML file alongside it.

## Sign In For Hosted Commands {#sign-in-for-hosted-commands}

Copy the CLI login command from **Consumer application setup**. The CLI
discovers the environment's public OAuth metadata from the platform:

```bash
pnpm lingva auth login
# Stage: pnpm lingva auth login --platform-url https://stage.lingva.dev
```

For local developer machines, prefer browser login over service tokens. Service tokens should stay reserved for CI and server-only dashboard routes.

## Push Hosted Delivery {#push-hosted-delivery}

```bash
pnpm lingva push \
  --output-dir .lingva/artifacts/push \
  --api-url "<copy publish URL from Lingva>" \
  --invalidate
```

This sends local translations to hosted delivery and saves the server response
as `.lingva/artifacts/push/publish-response.json`. It does not write local locale
bundle files; use `lingva bundle` or endpoint-free `lingva publish` for those.
The read-only SDK key cannot authorize this write operation.

## App Path {#app-path}

After the project exists in the dashboard:

- open `/app/projects/<project-id>` to copy setup values and create a read-only delivery SDK key
- open `/app/settings` to create or revoke project invites
- open `/app/translations` to review and edit translation drafts
- open `/app/delivery` to inspect publish history and delivery operations

## Why This Starter Exists {#why-this-starter-exists}

This template is intentionally small. It avoids fake API-key flows and focuses on the product path we can already verify today: config, typed React runtime, CLI auth, hosted publish, invalidation, and invite management.
