# Consumer repository guidance

This monorepo contains public consumer SDKs, customer CLI, examples, and product documentation. Keep applicable Lingva licenses unchanged.

Use pnpm workspaces only. Run package scripts from the root with `pnpm --filter @lingva/<name> <script>`. Use `workspace:*` for local packages. Build JavaScript packages through `scripts/build-package.mjs`; do not bypass source-map protection.

`crates/lingva-cli` owns customer commands. npm and Python are installation/launch adapters. JavaScript evaluates trusted executable config into temporary portable documents. Do not implement customer command behavior in adapters.

Run `pnpm verify:cli-adapters` after engine or adapter changes. After publishing a crates.io release, bump the engine patch before further changes and keep npm/Python version pins aligned. Rust production modules must carry module-level ownership comments and explain persistence, merge, security, fallback, and idempotency invariants.

Shared behavior selectors and API/bundle contracts belong in `@lingva/core`. Use named constants. Tests may assert literal wire values independently. Consumer examples must run without private packages or platform credentials in local delivery mode.

Public source is intentionally published under Lingva licenses. Never import private Git history, environment secrets, hosted application code, or operator tooling.
