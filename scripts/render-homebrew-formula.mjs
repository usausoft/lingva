#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { parseChecksumFile } from '../packages/cli/checksums.mjs';

const [releaseDirectory, version, assetBaseUrl] = process.argv.slice(2);
if (!releaseDirectory || !version) {
  throw new Error('Usage: render-homebrew-formula.mjs <release-directory> <version>');
}
if (!/^\d+\.\d+\.\d+$/u.test(version)) {
  throw new Error('Homebrew requires a stable semantic CLI version.');
}

const checksums = parseChecksumFile(await fs.readFile(path.join(releaseDirectory, 'SHA256SUMS'), 'utf8'));
const targets = {
  AARCH64_APPLE_DARWIN: 'lingva-aarch64-apple-darwin.tar.gz',
  X86_64_APPLE_DARWIN: 'lingva-x86_64-apple-darwin.tar.gz',
  AARCH64_UNKNOWN_LINUX_GNU: 'lingva-aarch64-unknown-linux-gnu.tar.gz',
  X86_64_UNKNOWN_LINUX_MUSL: 'lingva-x86_64-unknown-linux-musl.tar.gz',
};
let formula = await fs.readFile('packaging/homebrew/lingva.rb.template', 'utf8');
formula = formula.replaceAll('@VERSION@', version);
if (assetBaseUrl) {
  const parsed = new URL(assetBaseUrl);
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    /["\s\\]/u.test(assetBaseUrl)
  ) {
    throw new Error('Homebrew asset base must be an HTTPS URL without credentials, query, or fragment.');
  }
  formula = formula.replaceAll(`https://unpkg.com/@lingva/cli@${version}/assets`, assetBaseUrl.replace(/\/$/u, ''));
}
for (const [placeholder, file] of Object.entries(targets)) {
  const checksum = checksums[file];
  if (!checksum) {
    throw new Error(`Missing checksum for ${file}.`);
  }
  formula = formula.replaceAll(`@${placeholder}_SHA256@`, checksum);
}
await fs.writeFile(path.join(releaseDirectory, 'lingva.rb'), formula, 'utf8');
