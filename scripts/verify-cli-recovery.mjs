/** Read-only recovery gate: old Unix proofs + corrected Windows adapter proof. */
/* eslint-disable turbo/no-undeclared-env-vars -- Release boundary runs outside Turbo. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const WORKFLOW_PATH = '.github/workflows/release-cli.yml';
const RUN_STATUS_COMPLETE = 'completed';
const RUN_RESULT_SUCCESS = 'success';
const EVENT_PUSH = 'push';
const EVENT_DISPATCH = 'workflow_dispatch';
const WINDOWS_TARGET = 'x86_64-pc-windows-msvc';
const UNIX_TARGETS = [
  'x86_64-unknown-linux-musl',
  'aarch64-unknown-linux-gnu',
  'x86_64-apple-darwin',
  'aarch64-apple-darwin',
];
const ENGINE_SOURCES = [
  'Cargo.toml',
  'Cargo.lock',
  'crates/lingva-cli/src',
  'crates/lingva-cli/Cargo.toml',
  'packages/cli/src',
  'packages/cli/package.json',
  'packages/cli/install-native.mjs',
  'packages/cli/checksums.mjs',
  'packages/cli/lingva-installer.sh',
  'packages/cli/lingva-installer.ps1',
  'packages/core/src',
  'packages/core/package.json',
  'tsdown.shared.ts',
  'scripts/build-package.mjs',
  'packages/cli/tsdown.config.ts',
  'packages/core/tsdown.config.ts',
  'scripts/protect-build.mjs',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
];
const PROOF_SOURCES = [...ENGINE_SOURCES, 'scripts/smoke-cli-packages.mjs', 'sdks/python-cli', 'sdks/python'];

export function validateRecoveryWorkflow(proven, current) {
  // Only the private-repository publication metadata correction may differ.
  // The native build, smoke tests, permissions, and artifact upload stay exact.
  const correction =
    '        # npm rejects provenance from private source repositories. OIDC still\n' +
    '        # authenticates the approved trusted publisher without exposing source.\n';
  const normalize = (source) =>
    source
      .replace(correction, '')
      .replace(
        'publish --access public --provenance=false --no-git-checks',
        'publish --access public --provenance --no-git-checks'
      );
  assert.equal(normalize(current), normalize(proven), 'Windows build workflow must match the successful proof.');
}

function successfulBuild(jobs, target) {
  const matches = jobs.filter((job) => job.name === `Build ${target}`);
  assert.equal(matches.length, 1, `Exactly one ${target} proof is required.`);
  assert.equal(matches[0].conclusion, RUN_RESULT_SUCCESS, `${target} proof must have passed.`);
}

export function validateRecoveryProofs({ tag, releaseSha, original, originalJobs, windows, windowsJobs }) {
  for (const run of [original, windows]) {
    assert.equal(run.path, WORKFLOW_PATH, 'Proof must come from the approved CLI workflow.');
    assert.equal(run.status, RUN_STATUS_COMPLETE, 'Never reuse unfinished proofs.');
    assert.match(run.head_sha, /^[a-f\d]{40}$/u);
  }
  assert.equal(original.event, EVENT_PUSH);
  assert.equal(original.head_branch, tag);
  assert.equal(original.head_sha, releaseSha, 'Unix archives must belong to the immutable release tag.');
  for (const target of UNIX_TARGETS) successfulBuild(originalJobs, target);
  assert.equal(windows.event, EVENT_DISPATCH);
  assert.equal(windows.conclusion, RUN_RESULT_SUCCESS, 'Corrected Windows batch must have passed.');
  successfulBuild(windowsJobs, WINDOWS_TARGET);
}

function api(endpoint) {
  return JSON.parse(execFileSync('gh', ['api', endpoint], { encoding: 'utf8' }));
}

export function verifyRecovery() {
  const version = JSON.parse(fs.readFileSync('packages/cli/package.json', 'utf8')).version;
  assert.match(version, /^\d+\.\d+\.\d+$/u);
  const tag = process.env.CLI_RELEASE_TAG;
  assert.equal(tag, `cli/v${version}`, 'Recovery tag must match every adapter pin.');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/dev', 'Recovery publishing requires merged Development code.');
  const repository = process.env.GITHUB_REPOSITORY;
  assert.match(repository, /^[\w.-]+\/[\w.-]+$/u);
  const originalId = process.env.CLI_ORIGINAL_RUN_ID;
  const windowsId = process.env.CLI_WINDOWS_PROOF_RUN_ID;
  for (const id of [originalId, windowsId]) assert.match(id, /^[1-9]\d*$/u);
  const releaseSha = execFileSync('git', ['rev-parse', '--verify', `${tag}^{commit}`], { encoding: 'utf8' }).trim();
  const original = api(`repos/${repository}/actions/runs/${originalId}`);
  const windows = api(`repos/${repository}/actions/runs/${windowsId}`);
  validateRecoveryProofs({
    tag,
    releaseSha,
    original,
    windows,
    originalJobs: api(`repos/${repository}/actions/runs/${originalId}/attempts/1/jobs?per_page=100`).jobs,
    windowsJobs: api(`repos/${repository}/actions/runs/${windowsId}/jobs?per_page=100`).jobs,
  });
  // Adapter implementation and compiled Rust input may not change under a tag.
  execFileSync('git', ['diff', '--exit-code', releaseSha, 'HEAD', '--', ...ENGINE_SOURCES], { stdio: 'pipe' });
  // Windows Python corrections are allowed only when precisely that code passed.
  execFileSync('git', ['diff', '--exit-code', windows.head_sha, 'HEAD', '--', ...PROOF_SOURCES], { stdio: 'pipe' });
  validateRecoveryWorkflow(
    execFileSync('git', ['show', `${windows.head_sha}:${WORKFLOW_PATH}`], { encoding: 'utf8' }),
    fs.readFileSync(WORKFLOW_PATH, 'utf8')
  );
  console.log(`Verified immutable ${tag} source and all five native proof records.`);
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) verifyRecovery();
