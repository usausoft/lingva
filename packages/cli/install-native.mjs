#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { parseChecksumFile } from './checksums.mjs';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(packageRoot, '..', '..');
const MAX_ASSET_BYTES = 200 * 1024 * 1024;
const MAX_CHECKSUM_BYTES = 1024 * 1024;

function fail(message) {
  throw new Error(`@lingva/cli: ${message}`);
}

async function download(url, description, readResponse) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    fail(`Unable to download ${description}.`);
  }
  return readResponse(response);
}

async function limitedBytes(response, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) fail('Download exceeds the maximum asset size.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function resolveAssets({ asset, assetBaseUrl, packagedArchive, packagedChecksums, version }) {
  if (existsSync(packagedArchive) && existsSync(packagedChecksums)) {
    return Promise.all([fs.readFile(packagedArchive), fs.readFile(packagedChecksums, 'utf8')]);
  }

  return Promise.all([
    download(`${assetBaseUrl}/${asset}`, `native engine v${version}`, async (response) =>
      limitedBytes(response, MAX_ASSET_BYTES)
    ),
    download(`${assetBaseUrl}/SHA256SUMS`, `checksums for native engine v${version}`, async (response) =>
      (await limitedBytes(response, MAX_CHECKSUM_BYTES)).toString('utf8')
    ),
  ]);
}

if (existsSync(path.join(workspaceRoot, 'crates', 'lingva-cli', 'Cargo.toml'))) {
  if (process.env.LINGVA_CLI_NATIVE_REQUIRED === '1') {
    const workspaceBinary = process.env.LINGVA_CLI_BINARY;
    if (!workspaceBinary || !existsSync(workspaceBinary)) {
      fail('Workspace verification requires an existing LINGVA_CLI_BINARY.');
    }
    console.log(`@lingva/cli: using workspace engine at ${workspaceBinary}.`);
  }
  // Workspace builds compile Rust themselves. Downloading an unpublished
  // version here would make the release workflow impossible to bootstrap.
  process.exit(0);
}
const packageJson = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
const version = process.env.LINGVA_CLI_VERSION ?? packageJson.lingvaEngineVersion;
if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/u.test(version)) {
  fail('LINGVA_CLI_VERSION must be a semantic version.');
}
const defaultAssetBaseUrl = `https://unpkg.com/@lingva/cli@${version}/assets`;
const assetBaseUrl = (process.env.LINGVA_CLI_ASSET_BASE_URL ?? defaultAssetBaseUrl).replace(/\/$/u, '');
const targets = {
  'darwin-arm64': ['aarch64-apple-darwin', 'tar.gz'],
  'darwin-x64': ['x86_64-apple-darwin', 'tar.gz'],
  'linux-arm64': ['aarch64-unknown-linux-gnu', 'tar.gz'],
  'linux-x64': ['x86_64-unknown-linux-musl', 'tar.gz'],
  'win32-x64': ['x86_64-pc-windows-msvc', 'zip'],
};
const descriptor = targets[`${process.platform}-${process.arch}`];

if (!descriptor) {
  fail(`No standalone binary supports ${process.platform}/${process.arch}.`);
}

const [target, extension] = descriptor;
const asset = `lingva-${target}.${extension}`;
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-cli-'));
const archive = path.join(temp, asset);
const packagedArchive = path.join(packageRoot, 'assets', asset);
const packagedChecksums = path.join(packageRoot, 'assets', 'SHA256SUMS');
const vendor = path.join(packageRoot, 'vendor');
const executable = path.join(vendor, process.platform === 'win32' ? 'lingva.exe' : 'lingva');
let staging;
let installLock;

try {
  const [bytes, checksumSource] = await resolveAssets({
    asset,
    assetBaseUrl,
    packagedArchive: version === packageJson.lingvaEngineVersion ? packagedArchive : '',
    packagedChecksums: version === packageJson.lingvaEngineVersion ? packagedChecksums : '',
    version,
  });
  const expected = parseChecksumFile(checksumSource)[asset];
  if (bytes.length > MAX_ASSET_BYTES || Buffer.byteLength(checksumSource) > MAX_CHECKSUM_BYTES) {
    fail('Download exceeds the maximum asset size.');
  }
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (!expected || expected !== actual) {
    fail(`Checksum verification failed for ${asset}.`);
  }
  await fs.writeFile(archive, bytes);
  await fs.mkdir(vendor, { recursive: true });
  const lockPath = path.join(vendor, '.install.lock');
  const deadline = Date.now() + 60_000;
  while (!installLock) {
    try {
      await fs.mkdir(lockPath);
      installLock = lockPath;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() >= deadline)
        fail(
          'Timed out waiting for another installation; remove vendor/.install.lock only after that installer has stopped.'
        );
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  staging = await fs.mkdtemp(path.join(vendor, '.install-'));
  const stagedExecutable = path.join(staging, path.basename(executable));
  const extraction =
    extension === 'zip'
      ? spawnSync(
          'powershell',
          [
            '-NoProfile',
            '-Command',
            `Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip=[IO.Compression.ZipFile]::OpenRead('${archive.replace(/'/gu, "''")}'); try { if ($zip.Entries.Count -ne 1 -or $zip.Entries[0].FullName -ne 'lingva.exe' -or (($zip.Entries[0].ExternalAttributes -shr 16) -band 61440) -eq 40960 -or $zip.Entries[0].Length -gt ${MAX_ASSET_BYTES}) { throw 'Archive must contain one regular Lingva executable' }; [IO.Compression.ZipFileExtensions]::ExtractToFile($zip.Entries[0], '${stagedExecutable.replace(/'/gu, "''")}') } finally { $zip.Dispose() }`,
          ],
          {
            stdio: 'inherit',
          }
        )
      : (() => {
          const entries = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' });
          const types = spawnSync('tar', ['-tvzf', archive], { encoding: 'utf8' });
          if (
            entries.status !== 0 ||
            entries.stdout.trim() !== 'lingva' ||
            types.status !== 0 ||
            !types.stdout.startsWith('-') ||
            types.stdout.includes(' link to ') ||
            types.stdout.includes(' -> ') ||
            types.stdout.trim().split('\n').length !== 1
          ) {
            fail('Archive must contain one regular Lingva executable.');
          }
          // Streaming bytes, rather than extracting paths, cannot follow links.
          return spawnSync('tar', ['-xOzf', archive, 'lingva'], { maxBuffer: MAX_ASSET_BYTES });
        })();
  if (extraction.status !== 0) {
    fail(`Unable to extract ${asset}.`);
  }
  if (extension !== 'zip') await fs.writeFile(stagedExecutable, extraction.stdout);
  const binary = await fs.lstat(stagedExecutable);
  if (!binary.isFile() || binary.isSymbolicLink() || binary.size === 0) {
    fail('Archive must contain a non-empty regular Lingva executable.');
  }
  if (process.platform !== 'win32') {
    await fs.chmod(stagedExecutable, 0o755);
  }
  // Same-filesystem replacement cannot leave a partially extracted executable.
  await fs.rename(stagedExecutable, executable);
  console.log(`@lingva/cli: installed standalone engine v${version} for ${target}.`);
} catch (error) {
  if (error instanceof Error && error.message.startsWith('@lingva/cli:')) {
    throw error;
  }
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await fs.rm(temp, { force: true, recursive: true });
  if (staging) {
    await fs.rm(staging, { force: true, recursive: true });
  }
  if (installLock) await fs.rmdir(installLock);
}
