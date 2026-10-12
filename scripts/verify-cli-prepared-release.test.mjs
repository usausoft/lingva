import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';
import { validatePreparedBuild, validatePreparedProof } from './verify-cli-prepared-release.mjs';

function proof() {
  return {
    run: {
      path: '.github/workflows/release-cli.yml',
      event: 'workflow_dispatch',
      status: 'completed',
      conclusion: 'success',
      head_repository: { full_name: 'usausoft/lingva' },
      head_branch: 'main',
      head_sha: 'a'.repeat(40),
    },
    jobs: [
      'test / Rust quality',
      ...[
        'x86_64-unknown-linux-musl',
        'aarch64-unknown-linux-gnu',
        'x86_64-apple-darwin',
        'aarch64-apple-darwin',
        'x86_64-pc-windows-msvc',
      ].map((target) => `Build ${target}`),
    ].map((name) => ({ name, conclusion: 'success' })),
  };
}

test('prepared publication requires complete maintained-branch native proof from this repository', () => {
  const { run, jobs } = proof();
  assert.doesNotThrow(() => validatePreparedProof(run, jobs, 'usausoft/lingva'));
  for (const change of [
    { status: 'in_progress' },
    { conclusion: 'failure' },
    { event: 'pull_request' },
    { head_branch: 'unreviewed' },
    { head_repository: { full_name: 'other/lingva' } },
  ]) {
    assert.throws(() => validatePreparedProof({ ...run, ...change }, jobs, 'usausoft/lingva'));
  }
  assert.throws(() => validatePreparedProof(run, jobs.slice(1), 'usausoft/lingva'));
  assert.throws(() =>
    validatePreparedProof(
      run,
      jobs.map((job, index) => (index === 1 ? { ...job, conclusion: 'failure' } : job)),
      'usausoft/lingva'
    )
  );
});

test('prepared publication refuses changes to native build, matrix, runner, or test workflow', () => {
  const workflow = parse(fs.readFileSync('.github/workflows/release-cli.yml', 'utf8'));
  assert.doesNotThrow(() => validatePreparedBuild(workflow, structuredClone(workflow)));
  for (const key of ['steps', 'strategy', 'runs-on']) {
    const changed = structuredClone(workflow);
    changed.jobs.build[key] = 'changed';
    assert.throws(() => validatePreparedBuild(workflow, changed));
  }
  const changed = structuredClone(workflow);
  changed.jobs.test.uses = './unverified.yml';
  assert.throws(() => validatePreparedBuild(workflow, changed));
});
