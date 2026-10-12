import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const launcher = fileURLToPath(new URL('./native-launcher.ts', import.meta.url));
const installer = fileURLToPath(new URL('../install-native.mjs', import.meta.url));

function runLauncher(binary: string, args: string[], cwd?: string) {
  return spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), launcher, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, LINGVA_CLI_BINARY: binary },
  });
}

function runWorkspaceInstaller(binary: string) {
  return spawnSync(process.execPath, [installer], {
    encoding: 'utf8',
    env: {
      ...process.env,
      LINGVA_CLI_BINARY: binary,
      LINGVA_CLI_NATIVE_REQUIRED: '1',
    },
  });
}

test('workspace install rejects a required native engine that does not exist', () => {
  const missing = path.join(os.tmpdir(), `missing-lingva-install-${process.pid}`);
  const result = runWorkspaceInstaller(missing);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires an existing LINGVA_CLI_BINARY/u);
  assert.doesNotMatch(result.stderr, /Unable to download/u);
});

test('workspace install verifies the prebuilt engine without downloading a release', () => {
  const result = runWorkspaceInstaller(process.execPath);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /using workspace engine/u);
});

test(
  'published npm install extracts its bundled checksummed engine',
  { skip: process.platform === 'win32' },
  async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'lingva-npm-package-'));
    const assets = path.join(root, 'assets');
    const staging = path.join(root, 'staging');
    const target = `${process.arch === 'arm64' ? 'aarch64' : 'x86_64'}-${
      process.platform === 'darwin' ? 'apple-darwin' : 'unknown-linux-musl'
    }`;
    const asset = `lingva-${target}.tar.gz`;

    try {
      await Promise.all([mkdir(assets), mkdir(staging)]);
      await Promise.all([
        copyFile(installer, path.join(root, 'install-native.mjs')),
        copyFile(fileURLToPath(new URL('../checksums.mjs', import.meta.url)), path.join(root, 'checksums.mjs')),
        writeFile(path.join(root, 'package.json'), '{"lingvaEngineVersion":"9.9.9"}\n'),
        writeFile(path.join(staging, 'lingva'), '#!/bin/sh\nprintf "lingva 9.9.9\\n"\n'),
      ]);
      await chmod(path.join(staging, 'lingva'), 0o755);
      const packed = spawnSync('tar', ['-C', staging, '-czf', path.join(assets, asset), 'lingva'], {
        encoding: 'utf8',
      });
      assert.equal(packed.status, 0, packed.stderr);
      const archive = await readFile(path.join(assets, asset));
      const checksum = createHash('sha256').update(archive).digest('hex');
      await writeFile(path.join(assets, 'SHA256SUMS'), `${checksum}  ${asset}\n`);

      const result = spawnSync(process.execPath, [path.join(root, 'install-native.mjs')], {
        encoding: 'utf8',
        env: { ...process.env, LINGVA_CLI_ASSET_BASE_URL: 'http://127.0.0.1:1' },
      });

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /installed standalone engine v9\.9\.9/u);
      assert.equal(spawnSync(path.join(root, 'vendor', 'lingva'), { encoding: 'utf8' }).stdout, 'lingva 9.9.9\n');
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  }
);

test('native launcher treats an explicit missing binary as an error', () => {
  const missing = path.join(os.tmpdir(), `missing-lingva-${process.pid}`);
  const result = runLauncher(missing, ['--version']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /standalone Lingva CLI is missing/u);
});

test(
  'native launcher forwards customer arguments and preserves the engine exit status',
  { skip: process.platform === 'win32' },
  async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'lingva-launcher-'));
    const binary = path.join(root, 'lingva');
    await writeFile(binary, '#!/bin/sh\nprintf "%s\\n" "$@"\nexit 23\n');
    await chmod(binary, 0o755);

    try {
      for (const command of [
        'auth',
        'init',
        'update',
        'sync',
        'check',
        'pull',
        'push',
        'metadata',
        'apply',
        'approve',
        'studio',
        'drafts',
        'validate',
        'manifest',
        'bundle',
        'publish',
        'invalidate',
        'workflow',
        'types',
        'helpers',
        'export',
        'import',
        'extract',
      ]) {
        const result = runLauncher(binary, [command, '--locale', 'ru'], root);
        assert.equal(result.status, 23, `${command}: ${result.stderr}`);
        assert.equal(result.stdout, `${command}\n--locale\nru\n`);
      }
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  }
);
