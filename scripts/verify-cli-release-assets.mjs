/** Release boundary: refuse to publish an adapter missing any pinned engine. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseChecksumFile } from '../packages/cli/checksums.mjs';

const packageRoot = path.resolve(import.meta.dirname, '../packages/cli');
const manifest = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
assert.equal(manifest.version, manifest.lingvaEngineVersion, 'Adapter and engine must have the same release version.');
const checksums = parseChecksumFile(await fs.readFile(path.join(packageRoot, 'assets/SHA256SUMS'), 'utf8'));
const targets = [
  ['x86_64-unknown-linux-musl', 'tar.gz'],
  ['aarch64-unknown-linux-gnu', 'tar.gz'],
  ['x86_64-apple-darwin', 'tar.gz'],
  ['aarch64-apple-darwin', 'tar.gz'],
  ['x86_64-pc-windows-msvc', 'zip'],
];
for (const [target, extension] of targets) {
  const asset = `lingva-${target}.${extension}`;
  const bytes = await fs.readFile(path.join(packageRoot, 'assets', asset));
  assert.ok(bytes.length > 0, `${asset} must not be empty.`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), checksums[asset], `${asset} checksum mismatch.`);
}
console.log(`All five native assets verified for Lingva ${manifest.version}.`);
