# `@lingva/next`

Next.js App Router helpers built on the typed Lingva React runtime.

```bash
pnpm add @lingva/next @lingva/react
pnpm add -D @lingva/cli
```

Scaffold a local Client Component provider:

```bash
pnpm lingva init --mode local --no-auth --sdk next
```

This creates portable `lingva.config.yaml`, the typed runtime adapter at
`.lingva/generated/runtime.ts`, local resources at
`.lingva/generated/project.ts`, and `src/lingva/provider.tsx`. Mount the generated
`AppLingvaProvider` at the app boundary, then use `useTranslation`, `useLocale`,
`useLingva`, or `LingvaText` in Client Components.

The Next-specific helpers are `defineLingvaNextConfig`,
`configureLingvaNextClient`, and `createLingvaNextProvider`. The package also
re-exports React provider/hooks and core types; it does not currently provide
dedicated Server Component, middleware, or server-locale helpers.

For server-owned translations, create a separate `@lingva/js` or `@lingva/node`
runtime inside each request, load its locale before rendering, and call
`destroy()` afterward. Never register request-specific configuration through
the process-global `configureLingvaReact` or `configureLingvaNextClient` default.
Keep hosted write/admin credentials server-only. Browser delivery uses a
`delivery:read` key or an application-owned authenticated proxy.

[Read the Next.js guide](https://docs.lingva.dev/installation/nextjs).
