---
description: 'Conventions for the @lingva/cli package — applies under packages/cli/**'
applyTo: 'packages/cli/**'
---

# `@lingva/cli` instructions

The customer-facing CLI (`lingva ...`) plus operator commands (`serve`, `smoke`, `env-check`).

## Stack pins

- Build: **tsdown** → `dist/`, then `scripts/copy-cli-templates.mjs` and `scripts/protect-build.mjs` post-process. Don't bypass `protect-build.mjs`.
- Tests: **Node's built-in test runner via tsx** (`node --import tsx --test src/*.test.ts`). This is _different_ from the rest of the repo (Vitest) — don't accidentally introduce Vitest here.
- Run: `pnpm --filter @lingva/cli test | build | typecheck | lint`.

## Source layout

- `src/cli.ts` — entry point. Parses argv and dispatches to functions exported from `src/index.ts`.
- `src/index.ts` — public surface; one exported function per command.
- `src/contracts.ts` — typed option contracts.
- `src/templates/` — file templates copied into `dist/` at build time.
- Test files live next to source as `*.test.ts`.

## Command pattern

Every command follows this shape — preserve it when adding new commands:

1. CLI flags parsed in `cli.ts`.
2. A `resolve<Command>Options` helper normalizes flags + config + env into a typed options object.
3. The command function takes that options object and returns a result. No reading `process.argv` or `process.env` deep inside command logic.

This keeps commands testable without spawning a subprocess.

## Don't

- Don't use Vitest, Jest, or any other runner — stay on the Node test runner.
- Don't write to `dist/` directly; let `tsdown` + `protect-build.mjs` own it.
- Don't reach into `packages/core` internals — import from its public entry only.
