import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { parseChecksumFile } from '../packages/cli/checksums.mjs';

const targets = [
  'lingva-aarch64-apple-darwin.tar.gz',
  'lingva-x86_64-apple-darwin.tar.gz',
  'lingva-aarch64-unknown-linux-gnu.tar.gz',
  'lingva-x86_64-unknown-linux-musl.tar.gz',
];

test('parses portable checksum variants', () => {
  const first = 'a'.repeat(64);
  const second = 'B'.repeat(64);
  const checksums = parseChecksumFile(`${first}  first.tar.gz\r\n${second} *second.tar.gz\r\n`);

  assert.deepEqual(checksums, {
    'first.tar.gz': first,
    'second.tar.gz': second.toLowerCase(),
  });
});

test('rejects malformed checksum input', () => {
  assert.throws(() => parseChecksumFile('not-a-checksum'), /Invalid SHA256SUMS line/u);
});

test('rejects duplicate checksum entries without prototype-key ambiguity', () => {
  const digest = 'a'.repeat(64);
  assert.throws(() => parseChecksumFile(`${digest}  asset\n${digest}  asset\n`), /Duplicate/u);
  const entries = parseChecksumFile(`${digest}  __proto__\n`);
  assert.equal(Object.getPrototypeOf(entries), Object.prototype);
  assert.equal(entries.__proto__, digest);
});

test('renders a complete Homebrew formula from release checksums', async () => {
  const releaseDirectory = await mkdtemp(path.join(os.tmpdir(), 'lingva-homebrew-'));

  try {
    const checksums = targets.map((target, index) => `${String(index + 1).repeat(64)}  ${target}`).join('\n');
    await writeFile(path.join(releaseDirectory, 'SHA256SUMS'), `${checksums}\n`, 'utf8');

    const result = spawnSync(process.execPath, ['scripts/render-homebrew-formula.mjs', releaseDirectory, '0.1.2'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    const formula = await readFile(path.join(releaseDirectory, 'lingva.rb'), 'utf8');
    assert.match(formula, /version "0\.1\.2"/u);
    assert.match(formula, /https:\/\/unpkg\.com\/@lingva\/cli@0\.1\.2\/assets/u);
    for (let index = 0; index < targets.length; index += 1) {
      assert.match(formula, new RegExp(String(index + 1).repeat(64), 'u'));
    }
    assert.doesNotMatch(formula, /@[A-Z0-9_]+@/u);
    const base = 'https://github.com/usausoft/homebrew-tap/releases/download/cli/v0.1.2';
    const mirrored = spawnSync(
      process.execPath,
      ['scripts/render-homebrew-formula.mjs', releaseDirectory, '0.1.2', base],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      }
    );
    assert.equal(mirrored.status, 0, mirrored.stderr);
    const mirroredFormula = await readFile(path.join(releaseDirectory, 'lingva.rb'), 'utf8');
    assert.ok(mirroredFormula.includes(base));
    assert.ok(!mirroredFormula.includes('unpkg.com'));
    for (const invalid of [
      'http://example.test',
      'https://user:password@example.test',
      'https://example.test/"injected',
      'https://example.test/?token=secret',
    ]) {
      const rejected = spawnSync(
        process.execPath,
        ['scripts/render-homebrew-formula.mjs', releaseDirectory, '0.1.2', invalid],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        }
      );
      assert.notEqual(rejected.status, 0);
      assert.equal(await readFile(path.join(releaseDirectory, 'lingva.rb'), 'utf8'), mirroredFormula);
    }
  } finally {
    await rm(releaseDirectory, { force: true, recursive: true });
  }
});
