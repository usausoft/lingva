# Workspace dependency security repair

## 10 November 2026 checkpoint

The follow-up repair pins the Nuxt reference starter to4.6.3 and scopes workspace overrides to `glob@>=9.0.0 <=14.0.1` →14.0.2, `minimatch@>=7.0.0 <11.0.1` →11.0.1 and `node-forge@<=1.4.0` →1.4.1. Nuxt's published Node requirement remains `^22.22.3 || ^24.15.0 || >=26.0.0`. These are major transitive glob/minimatch replacements, not a universal compatibility guarantee. Regenerate and freeze the lock with the declared pnpm12.8.1.

Nuxt's resolved Nitro2.13.6 also selects Archiver8/readdir-glob3. The installed-consumer regression imports the actual ESM `ZipArchive` owner and verifies filtered ZIP entries. Additional cases cover NFT Promise/sync matching, cancellation stopping directory reads, TypeScript/Vue matcher forms, bounded malformed PEM parsing and preservation of valid RSA plus nested DigestInfo rejection. The malformed-PEM baseline completed within its budget; this repair does not claim to have reproduced a PEM timeout.

The published forge1.4.1 replaces the old forge1.4.0 patch and its exact advisory exception. The deepmerge patch and existing braces/deepmerge exceptions remain. No advisory exception is added. Fresh production audit exits0 and returns no advisory objects; raw metadata still counts one low-severity finding covered by the existing policy. This is not an exception-free audit.

Fresh isolated frozen installation and an offline frozen repeat pass. Local acceptance includes31 installed security tests,358 core tests,70 workspace tasks,11 protected public package builds and all11 isolated ESM/CJS/type/license/public-boundary consumer checks. Nuxt cold preparation, production build, English/Russian SSR and browser locale switching/reload persistence pass. A fresh packed core consumer also verifies the publication action, exhaustive-map migration and retained guarded-HTTP export. All public package versions, licenses, Rust/CLI sources and pins remain unchanged. No package is published and no hosted operation runs.

Rollback the follow-up manifests, policy, forge-patch retirement and lock together to the pre-repair checkpoint, then install frozen. This restores the known audit blocker. The earlier publication-action change can remain independently reviewable.

## 29 October 2026 checkpoint (historical)

The workspace dependency audit fails against the existing lockfile. Repair the dependency owners and verify local compatibility while preserving all Lingva package versions, licenses and guarded approval codec sources. No package publication, hosted operation or deployment belongs to this repair.

Use published patched versions: Next16.4.1, Nuxt4.6.2, Vite8.1.6, launch-editor2.14.2, Zod4.6.6, Undici8.12.2, serialize-javascript7.1.3, fast-uri3.1.9 and seroval1.6.11. Keep transitive security overrides in `pnpm-workspace.yaml`, scoped to the affected major where necessary. Regenerate the lockfile through pnpm and prove a frozen installation.

The SvelteKit starter moves to3.0.0, adapter-auto8.0.0, Svelte>=5.57.1 (locked5.57.3) and TypeScript6.0.3. Only that starter requires TypeScript6. Use explicit `#lib/*` subpath imports and the relocated hooks type without changing locale logic. Move its existing preprocess/adapter options from `svelte.config.js` into the Vite plugin; use `$app/tsconfig` and explicit include/exclude paths. Preserve locale selection, SSR output and public SDK interfaces. Follow the [official migration guide](https://github.com/sveltejs/kit/blob/main/documentation/docs/60-appendix/35-migrating-to-sveltekit-3.md).

Deepmerge4.3.1 has no patched release for [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4). Apply a local defensive patch following the [reporter's key-guard recommendation](https://github.com/TehShrike/deepmerge/issues/273): reject `__proto__`, `constructor` and `prototype` in both target and source copy paths. Patch source and both shipped CJS/UMD artifacts. This is a local mitigation, not a claimed upstream release or maintainer patch. Preserve ordinary object, array, symbol and custom-merge behavior.

Prove the exploit with real installed CJS/UMD entrypoints before patching, then prove rejection and compatibility afterward. Add an unconditional local dependency-security test command to repository CI checks. Only after the installed patch passes may the exact deepmerge advisory receive a documented registry-audit exception, because the registry sees the original package version. Existing braces/node-forge exceptions and the node-forge patch remain unchanged. Never suppress other advisories or skip the audit.

Acceptance: no unsuppressed production audit findings, passing exploit/compatibility tests and frozen install, unchanged codec source hashes and250 core tests, full affected workspace lint/types/tests/builds, all11 public build/tarball consumer checks, and real local HTTP checks for the changed Next/Nuxt/SvelteKit starters. Keep one existing PR; report any remaining blocker honestly.

Rollback is a Git revert of this repair's commit followed by frozen installation. It restores the previous manifests, lockfile, configuration and patch policy together; it also restores their known audit failures. No persistent application data is migrated.

For the Nuxt starter, production builds run `nuxt typecheck` before bundling. The duplicate Vite checker is disabled because its shell invocation splits absolute project paths containing spaces. Standalone type checks remain available; the in-dev checker overlay is not enabled by this repair.

Local verification on29 October2026:23 installed-artifact/graph tests,250 core tests,70 workspace tasks,19 builds,11 public candidate consumer checks and10 production HTTP scenarios pass. Frozen installation and peer checks pass. Registry audit exits0 with no active advisory objects; its raw metadata still counts the two explicitly ignored patched node-forge/deepmerge findings. This is not a claim of an exception-free audit. Lingva package manifests, codec sources and licenses match the pre-repair source.
