#!/usr/bin/env node

// The public tap follows stable npm releases without credentials for the private
// source repository. Never downgrade a manually seeded, newer binary release.
import fs from 'node:fs/promises';
import os from 'node:os';
import process from 'node:process';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HTTP_METHOD_HEAD = 'HEAD';

export function compareStableVersions(left, right) {
  const parts = (value) => {
    if (!/^\d+\.\d+\.\d+$/u.test(value)) throw new Error(`Not a stable CLI version: ${value}`);
    return value.split('.').map(Number);
  };
  const a = parts(left);
  const b = parts(right);
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) return Math.sign(a[index] - b[index]);
  }
  return 0;
}

export async function updateHomebrewTap({ root = process.cwd(), fetchImpl = fetch } = {}) {
  const formulaPath = path.join(root, 'Formula/lingva.rb');
  const current = await fs.readFile(formulaPath, 'utf8');
  const currentVersion = current.match(/version "([^"]+)"/u)?.[1];
  if (!currentVersion) throw new Error('Current tap formula has no version.');
  const metadata = await fetchImpl('https://registry.npmjs.org/@lingva%2fcli/latest');
  if (!metadata.ok) throw new Error(`npm metadata unavailable: ${metadata.status}`);
  const { version } = await metadata.json();
  if (compareStableVersions(version, currentVersion) <= 0) return false;
  const base = `https://unpkg.com/@lingva/cli@${version}/assets`;
  const checksumResponse = await fetchImpl(`${base}/SHA256SUMS`);
  if (!checksumResponse.ok) throw new Error(`Release checksums unavailable: ${checksumResponse.status}`);
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-brew-update-'));
  try {
    await fs.writeFile(path.join(temporary, 'SHA256SUMS'), await checksumResponse.text());
    execFileSync(process.execPath, ['scripts/render-homebrew-formula.mjs', temporary, version], {
      cwd: root,
      stdio: 'pipe',
    });
    // Verify all four public URLs before replacing a working formula. Its SHA256
    // entries remain the release's authority; Homebrew verifies archive integrity.
    for (const target of [
      'aarch64-apple-darwin',
      'x86_64-apple-darwin',
      'aarch64-unknown-linux-gnu',
      'x86_64-unknown-linux-musl',
    ]) {
      const response = await fetchImpl(`${base}/lingva-${target}.tar.gz`, { method: HTTP_METHOD_HEAD });
      if (!response.ok) throw new Error(`Public ${target} archive unavailable: ${response.status}`);
    }
    await fs.copyFile(path.join(temporary, 'lingva.rb'), formulaPath);
    return true;
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log((await updateHomebrewTap()) ? 'Updated Lingva formula.' : 'No newer stable CLI release.');
}
