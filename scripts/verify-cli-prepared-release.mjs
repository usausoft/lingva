/** Reuse a complete native proof only when all compiled and installation inputs remain identical. */
/* eslint-disable turbo/no-undeclared-env-vars -- Standalone release boundary. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const WORKFLOW_PATH = '.github/workflows/release-cli.yml';
const TARGETS = [
  'x86_64-unknown-linux-musl',
  'aarch64-unknown-linux-gnu',
  'x86_64-apple-darwin',
  'aarch64-apple-darwin',
  'x86_64-pc-windows-msvc',
];
const PROOF_INPUTS = [
  'Cargo.toml',
  'Cargo.lock',
  'crates',
  'packages/cli',
  'packages/core',
  'sdks/python-cli',
  'sdks/python',
  'scripts/build-package.mjs',
  'scripts/protect-build.mjs',
  'scripts/smoke-cli-packages.mjs',
  'scripts/verify-public-boundary.mjs',
  'tsdown.shared.ts',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.github/workflows/cli-quality.yml',
];

export function validatePreparedProof(run, jobs, repository) {
  assert.equal(run.path, WORKFLOW_PATH);
  assert.equal(run.event, 'workflow_dispatch');
  assert.equal(run.status, 'completed');
  assert.equal(run.conclusion, 'success');
  assert.equal(run.head_repository.full_name, repository, 'Never reuse fork artifacts.');
  assert.ok(['main', 'dev'].includes(run.head_branch), 'Proof must come from a maintained branch.');
  assert.match(run.head_sha, /^[a-f\d]{40}$/u);
  for (const name of ['test / Rust quality', ...TARGETS.map((target) => `Build ${target}`)]) {
    const matches = jobs.filter((job) => job.name === name);
    assert.equal(matches.length, 1, `Exactly one ${name} proof is required.`);
    assert.equal(matches[0].conclusion, 'success', `${name} must pass.`);
  }
}

export function validatePreparedBuild(proven, current) {
  for (const key of ['steps', 'strategy', 'runs-on'])
    assert.deepEqual(current.jobs.build[key], proven.jobs.build[key], `Native build ${key} changed.`);
  assert.equal(current.jobs.test.uses, proven.jobs.test.uses);
}

function api(endpoint, args = []) {
  return JSON.parse(execFileSync('gh', ['api', endpoint, ...args], { encoding: 'utf8' }));
}

function verifyPreparedRelease() {
  const repository = process.env.GITHUB_REPOSITORY;
  assert.match(repository, /^[\w.-]+\/[\w.-]+$/u);
  assert.ok(['refs/heads/main', 'refs/heads/dev'].includes(process.env.GITHUB_REF));
  const runId = process.env.CLI_PREPARED_RUN_ID;
  assert.match(runId, /^[1-9]\d*$/u);
  const version = JSON.parse(fs.readFileSync('packages/cli/package.json', 'utf8')).version;
  assert.match(version, /^\d+\.\d+\.\d+$/u);
  const tag = `cli/v${version}`;
  assert.equal(process.env.CLI_RELEASE_TAG, tag);
  const run = api(`repos/${repository}/actions/runs/${runId}`);
  const jobs = api(`repos/${repository}/actions/runs/${runId}/jobs?per_page=100`).jobs;
  validatePreparedProof(run, jobs, repository);
  execFileSync('git', ['diff', '--exit-code', run.head_sha, 'HEAD', '--', ...PROOF_INPUTS], { stdio: 'pipe' });
  validatePreparedBuild(
    parse(execFileSync('git', ['show', `${run.head_sha}:${WORKFLOW_PATH}`], { encoding: 'utf8' })),
    parse(fs.readFileSync(WORKFLOW_PATH, 'utf8'))
  );
  // Tag the reviewed publication revision. GitHub's workflow token cannot tag
  // an older revision that changes workflows relative to the default branch.
  // The diff above proves every compiled and installation input is unchanged.
  const releaseSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const artifacts = api(`repos/${repository}/actions/runs/${runId}/artifacts?per_page=100`).artifacts;
  for (const target of TARGETS) {
    const matches = artifacts.filter((artifact) => artifact.name === `lingva-${target}`);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].expired, false);
  }
  const refs = api(`repos/${repository}/git/matching-refs/tags/${tag}`).filter((ref) => ref.ref === `refs/tags/${tag}`);
  if (refs.length) assert.equal(refs[0].object.sha, releaseSha, 'Never move an immutable release tag.');
  else
    api(`repos/${repository}/git/refs`, ['--method', 'POST', '-f', `ref=refs/tags/${tag}`, '-f', `sha=${releaseSha}`]);
  console.log(`Verified ${tag}: all five native artifacts belong to ${run.head_sha}.`);
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) verifyPreparedRelease();
