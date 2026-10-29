# Workspace Dependency Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the existing dependency-audit blocker with reproducible patched dependencies and local compatibility proof.

**Architecture:** Existing workspace override policy owns transitive version floors. Direct starter manifests own framework upgrades. One narrowly scoped deepmerge patch and installed-artifact regression suite cover the dependency with no fixed release.

**Tech Stack:** Existing pnpm12.8.1, Node24, node:test, workspace/Turbo builds and public package consumer harness.

**Spec:** `docs/specs/workspace-dependency-security.md`.

## Global Constraints

- Preserve Lingva versions, licenses, public contracts and all guarded approval codec source bytes; no hosted operations, publication or deployment.
- Use the spec's exact published patched versions and existing installation/build policy. Keep TypeScript6 scoped to the SvelteKit starter.
- Patch deepmerge source/CJS/UMD and prove real exploit RED/GREEN before a single documented exact-advisory exception. Existing exceptions and node-forge patch remain unchanged.
- Keep the existing PR; do not open a successor. Roll back all repair inputs together through Git and frozen install.

## Review Focus

- Poisoned keys on source, target, null-prototype objects and nested placeholders must never change the returned object's prototype.
- Shipped CJS and UMD artifacts must both receive the patch; a registry exception must not outlive its effective installed mitigation.
- Ordinary arrays, symbols, custom merge callbacks and nonmutating merge behavior must remain compatible.
- SvelteKit3 configuration and TypeScript6 must preserve real SSR locale selection without leaking changed toolchain requirements into public SDK packages.
- Frozen installation, all workspace gates and packed consumers must exercise the actual changed dependency graph without disabling audit or source-map/license protection.

---

### Task 1: Repair and verify the workspace dependency owners

**Files:** Modify `pnpm-workspace.yaml`, generated `pnpm-lock.yaml`, `package.json`, `scripts/ci-run-workspace.mjs`, Next/Nuxt/SvelteKit starter manifests and SvelteKit configuration; remove its obsolete `svelte.config.js`. Create `patches/deepmerge@4.3.1.patch` and `scripts/dependency-security.test.mjs`. Update these public documents with actual evidence after verification.

**Interfaces:** Existing pnpm frozen install, `pnpm audit:prod`, new `pnpm test:dependency-security`, existing workspace lint/typecheck/test/build and public tarball consumers. No Lingva runtime API changes.

- [x] **Step1: Establish RED.** Save fresh audit JSON and exact registry metadata. Add real installed CJS/UMD tests for poisoned source/target keys, null prototypes and nested placeholders, plus ordinary array/symbol/custom-merge compatibility. Run `node --test scripts/dependency-security.test.mjs`; expected real prototype/key assertion failures, with ordinary compatibility controls passing.
- [x] **Step2: Apply narrow repairs.** Update exact owner versions and scoped overrides, migrate only SvelteKit starter configuration using the official guide, and generate the deepmerge patch through `pnpm patch`/`patch-commit`. Preserve dependency installation policy and all Lingva source/version/license inputs. Expected frozen install and exploit/compatibility GREEN.
- [x] **Step3: Connect and verify the audit boundary.** Add the installed-artifact test command to existing repository checks. Document only the exact deepmerge patched-advisory exception after GREEN. Run frozen install and `pnpm audit:prod`; expected zero unsuppressed findings under the explicitly recorded exception policy.
- [x] **Step4: Verify compatibility.** Run full workspace lint/types/tests/build, all11 public package builds/tarball consumers, and local HTTP locale smoke for Next/Nuxt/SvelteKit output. Compare codec/license/version hashes with basebf4228b. Expected all relevant gates pass and no source/version/license drift.
- [x] **Step5: Record and commit.** Mark actual checks, commit the coherent repair, and run task-done with `pnpm test:dependency-security`. Expected23 installed-artifact/graph tests pass; no merge or release claim.

## Final review and handoff

Obtain one fresh whole-branch review of this repair after task completion; fix Important/Critical findings in one RED/GREEN pass and ledger genuine Minor deferrals. Update the existing PR and private tracking only. Archive and remove only this plan’s owned ignored scratch; preserve the worktree for review.

## Self-review

One dependency graph repair owns the framework compatibility and patch tests together. Each review risk has an installed-artifact or real starter check. Existing codec acceptance remains a separate immutable source comparison. The native workflow continues under the user's instruction to proceed; no extra implementation-method gate is introduced.
