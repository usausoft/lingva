import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRecoveryProofs, validateRecoveryWorkflow } from './verify-cli-recovery.mjs';
import fs from 'node:fs';

test('private-source publication correction preserves the exact Windows build workflow', () => {
  const current = fs.readFileSync('.github/workflows/release-cli.yml', 'utf8');
  const proven = current
    .replace(
      '        # npm rejects provenance from private source repositories. OIDC still\n' +
        '        # authenticates the approved trusted publisher without exposing source.\n',
      ''
    )
    .replace('--provenance=false', '--provenance');
  assert.doesNotThrow(() => validateRecoveryWorkflow(proven, current));
  assert.doesNotThrow(() => validateRecoveryWorkflow(current, current));
  for (const [before, after] of [
    ['cargo test --workspace --locked', 'cargo test --workspace'],
    ['node scripts/smoke-cli-packages.mjs', 'node scripts/skip-smoke.mjs'],
    ['actions/upload-artifact@v7', 'actions/upload-artifact@v6'],
    ['id-token: write', 'id-token: read'],
  ]) {
    assert.throws(() => validateRecoveryWorkflow(proven, current.replace(before, after)));
  }
});

function proof() {
  const tag = 'cli/v0.1.4';
  const releaseSha = 'a'.repeat(40);
  const base = { path: '.github/workflows/release-cli.yml', status: 'completed', head_sha: releaseSha };
  return {
    tag,
    releaseSha,
    original: { ...base, event: 'push', head_branch: tag, conclusion: 'failure' },
    windows: { ...base, event: 'workflow_dispatch', conclusion: 'success' },
    originalJobs: [
      'x86_64-unknown-linux-musl',
      'aarch64-unknown-linux-gnu',
      'x86_64-apple-darwin',
      'aarch64-apple-darwin',
    ].map((target) => ({ name: `Build ${target}`, conclusion: 'success' })),
    windowsJobs: [{ name: 'Build x86_64-pc-windows-msvc', conclusion: 'success' }],
  };
}

test('recovery accepts only four verified tag archives and successful corrected Windows proof', () => {
  assert.doesNotThrow(() => validateRecoveryProofs(proof()));
});

for (const field of ['original', 'windows']) {
  for (const override of [
    { path: '.github/workflows/other.yml' },
    { status: 'in_progress' },
    { head_sha: 'not-a-sha' },
  ]) {
    test(`recovery rejects invalid ${field} identity ${JSON.stringify(override)}`, () => {
      const value = proof();
      Object.assign(value[field], override);
      assert.throws(() => validateRecoveryProofs(value));
    });
  }
}

for (const override of [{ head_sha: 'b'.repeat(40) }, { head_branch: 'cli/v0.1.3' }, { event: 'workflow_dispatch' }]) {
  test(`recovery rejects wrong original release ${JSON.stringify(override)}`, () => {
    const value = proof();
    Object.assign(value.original, override);
    assert.throws(() => validateRecoveryProofs(value));
  });
}

for (const field of ['originalJobs', 'windowsJobs']) {
  for (const failure of ['failure', 'cancelled', 'skipped', 'missing', 'duplicate']) {
    test(`recovery rejects ${field} ${failure} proof`, () => {
      const value = proof();
      if (failure === 'missing') value[field].pop();
      else if (failure === 'duplicate') value[field].push({ ...value[field][0] });
      else value[field][0].conclusion = failure;
      assert.throws(() => validateRecoveryProofs(value));
    });
  }
}

for (const override of [{ event: 'push' }, { conclusion: 'failure' }]) {
  test(`recovery rejects unverified Windows batch ${JSON.stringify(override)}`, () => {
    const value = proof();
    Object.assign(value.windows, override);
    assert.throws(() => validateRecoveryProofs(value));
  });
}
