import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// Hand-built archives deliberately retain unsafe names/links that tar creation
// tools would normalize. Installers must reject them before filesystem writes.
function archive(entries: { name: string; type?: string; body?: string; link?: string }[]) {
  const chunks: Buffer[] = [];
  for (const entry of entries) {
    const header = Buffer.alloc(512);
    const body = Buffer.from(entry.body ?? 'engine');
    header.write(entry.name, 0, 100);
    header.write('0000755\0', 100);
    header.write('0000000\0', 108);
    header.write('0000000\0', 116);
    header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124);
    header.write('00000000000\0', 136);
    header.fill(32, 148, 156);
    header.write(entry.type ?? '0', 156);
    if (entry.link) header.write(entry.link, 157, 100);
    header.write('ustar\0', 257);
    header.write('00', 263);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148);
    chunks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  return gzipSync(Buffer.concat([...chunks, Buffer.alloc(1024)]));
}

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const architecture = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
const linuxTarget = process.arch === 'arm64' ? 'aarch64-unknown-linux-gnu' : 'x86_64-unknown-linux-musl';
const target = process.platform === 'darwin' ? `${architecture}-apple-darwin` : linuxTarget;

for (const adapter of ['npm', 'shell']) {
  test(
    `${adapter} installer rejects corrupt, ambiguous, unsafe, and empty archives without replacing existing engine`,
    { skip: process.platform === 'win32' },
    async () => {
      const cases = [
        { name: 'valid', entries: [{ name: 'lingva', body: '#!/bin/sh\nexit 0\n' }], success: true },
        { name: 'empty', entries: [{ name: 'lingva', body: '' }] },
        { name: 'symlink', entries: [{ name: 'lingva', type: '2', link: '../outside' }] },
        { name: 'hardlink', entries: [{ name: 'lingva', type: '1', link: '../outside' }] },
        { name: 'traversal', entries: [{ name: '../lingva' }] },
        { name: 'absolute', entries: [{ name: '/lingva' }] },
        { name: 'extra', entries: [{ name: 'lingva' }, { name: '../outside' }] },
        { name: 'duplicate', entries: [{ name: 'lingva' }, { name: 'lingva' }] },
        { name: 'duplicate-checksum', entries: [{ name: 'lingva' }] },
        { name: 'corrupt', entries: [{ name: 'lingva' }] },
      ];
      for (const fixture of cases) {
        const root = await mkdtemp(path.join(os.tmpdir(), 'lingva-installer-test-'));
        try {
          const assets = path.join(root, 'assets');
          const vendor = path.join(root, 'vendor');
          const tools = path.join(root, 'tools');
          await Promise.all([mkdir(assets), mkdir(vendor), mkdir(tools)]);
          const asset = `lingva-${target}.tar.gz`;
          const bytes = archive(fixture.entries);
          const checksum = `${createHash('sha256').update(bytes).digest('hex')}  *${asset}\n`;
          await writeFile(path.join(assets, asset), fixture.name === 'corrupt' ? bytes.subarray(0, 20) : bytes);
          await writeFile(
            path.join(assets, 'SHA256SUMS'),
            fixture.name === 'duplicate-checksum' ? checksum.repeat(2) : checksum
          );
          await writeFile(path.join(vendor, 'lingva'), 'previous engine');
          await writeFile(path.join(root, 'outside'), 'untouched');
          await writeFile(path.join(root, 'package.json'), '{"lingvaEngineVersion":"9.9.9"}');
          await Promise.all(
            ['install-native.mjs', 'checksums.mjs'].map((file) =>
              copyFile(path.join(packageRoot, file), path.join(root, file))
            )
          );
          await writeFile(
            path.join(tools, 'curl'),
            '#!/bin/sh\nwhile [ "$#" -gt 0 ]; do\ncase "$1" in --output) shift; output="$1" ;; http*) url="$1" ;; esac\nshift\ndone\ncp "$TEST_ASSETS/$(basename "$url")" "$output"\n'
          );
          await chmod(path.join(tools, 'curl'), 0o755);
          // PATH selects the fixture curl only; it is not a build-cache input.
          // eslint-disable-next-line turbo/no-undeclared-env-vars
          const fixturePath = `${tools}${path.delimiter}${process.env.PATH}`;
          const env = {
            ...process.env,
            LINGVA_CLI_VERSION: '9.9.9',
            LINGVA_CLI_INSTALL_DIR: vendor,
            LINGVA_CLI_ASSET_BASE_URL: 'https://fixture.test',
            TEST_ASSETS: assets,
            PATH: fixturePath,
          };
          const result =
            adapter === 'npm'
              ? spawnSync(process.execPath, [path.join(root, 'install-native.mjs')], { env, encoding: 'utf8' })
              : spawnSync('sh', [path.join(packageRoot, 'lingva-installer.sh')], { env, encoding: 'utf8' });
          assert.equal(result.status === 0, Boolean(fixture.success), `${adapter}/${fixture.name}: ${result.stderr}`);
          assert.equal(await readFile(path.join(root, 'outside'), 'utf8'), 'untouched');
          if (!fixture.success) assert.equal(await readFile(path.join(vendor, 'lingva'), 'utf8'), 'previous engine');
        } finally {
          await rm(root, { recursive: true, force: true });
        }
      }
    }
  );
}
