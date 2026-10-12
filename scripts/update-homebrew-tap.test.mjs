import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compareStableVersions, updateHomebrewTap } from './update-homebrew-tap.mjs';

test('compares stable versions numerically and rejects prerelease/malformed input', () => {
  assert.equal(compareStableVersions('0.1.10', '0.1.3'), 1);
  assert.equal(compareStableVersions('0.0.1', '0.1.3'), -1);
  assert.equal(compareStableVersions('0.1.3', '0.1.3'), 0);
  assert.throws(() => compareStableVersions('0.1.4-alpha', '0.1.3'));
  assert.throws(() => compareStableVersions(undefined, '0.1.3'));
});

test('does not downgrade the seed or fetch assets for an unchanged version', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-brew-test-'));
  try {
    await fs.mkdir(path.join(root, 'Formula'));
    const original = 'version "0.1.3"\n';
    await fs.writeFile(path.join(root, 'Formula/lingva.rb'), original);
    for (const version of ['0.0.1', '0.1.3']) {
      let calls = 0;
      assert.equal(
        await updateHomebrewTap({
          root,
          fetchImpl: async () => {
            calls++;
            return { ok: true, json: async () => ({ version }) };
          },
        }),
        false
      );
      assert.equal(calls, 1);
      assert.equal(await fs.readFile(path.join(root, 'Formula/lingva.rb'), 'utf8'), original);
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('missing release checksums leave the current formula unchanged', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-brew-test-'));
  try {
    await fs.mkdir(path.join(root, 'Formula'));
    const original = 'version "0.1.3"\n';
    await fs.writeFile(path.join(root, 'Formula/lingva.rb'), original);
    await assert.rejects(
      updateHomebrewTap({
        root,
        fetchImpl: async (url) =>
          url.endsWith('/latest') ? { ok: true, json: async () => ({ version: '0.1.4' }) } : { ok: false, status: 404 },
      }),
      /checksums unavailable/
    );
    assert.equal(await fs.readFile(path.join(root, 'Formula/lingva.rb'), 'utf8'), original);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('updates only when checksums and every public archive are available', async () => {
  const targets = [
    'aarch64-apple-darwin',
    'x86_64-apple-darwin',
    'aarch64-unknown-linux-gnu',
    'x86_64-unknown-linux-musl',
  ];
  const checksums = targets.map((target) => `${'a'.repeat(64)}  lingva-${target}.tar.gz`).join('\n');
  for (const scenario of ['success', 'missing-archive', 'bad-checksums']) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-brew-test-'));
    try {
      for (const directory of ['Formula', 'scripts', 'packaging/homebrew', 'packages/cli']) {
        await fs.mkdir(path.join(root, directory), { recursive: true });
      }
      for (const file of [
        'scripts/render-homebrew-formula.mjs',
        'packaging/homebrew/lingva.rb.template',
        'packages/cli/checksums.mjs',
      ]) {
        await fs.copyFile(file, path.join(root, file));
      }
      const original = 'version "0.1.3"\n';
      await fs.writeFile(path.join(root, 'Formula/lingva.rb'), original);
      const update = updateHomebrewTap({
        root,
        fetchImpl: async (url) => {
          if (url.endsWith('/latest')) return { ok: true, json: async () => ({ version: '0.1.4' }) };
          if (url.endsWith('/SHA256SUMS'))
            return { ok: true, text: async () => (scenario === 'bad-checksums' ? 'invalid' : checksums) };
          return { ok: scenario !== 'missing-archive', status: 404 };
        },
      });
      if (scenario === 'success') {
        assert.equal(await update, true);
        assert.match(await fs.readFile(path.join(root, 'Formula/lingva.rb'), 'utf8'), /version "0\.1\.4"/u);
      } else {
        await assert.rejects(update);
        assert.equal(await fs.readFile(path.join(root, 'Formula/lingva.rb'), 'utf8'), original);
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  }
});
