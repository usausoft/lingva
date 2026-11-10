import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readdir } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import process from 'node:process';
import { parseAllDocuments, parse } from 'yaml';

const root = new URL('../', import.meta.url);
const at = (name) => new URL(name, root);
function from(parent, dependency) {
  const resolver = createRequire(parent);
  try {
    return resolver.resolve(`${dependency}/package.json`);
  } catch (error) {
    if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error;
    let dir = path.dirname(resolver.resolve(dependency));
    while (path.dirname(dir) !== dir) {
      try {
        const file = path.join(dir, 'package.json');
        if (JSON.parse(readFileSync(file)).name === dependency) return file;
      } catch (cause) {
        if (cause.code !== 'ENOENT') throw cause;
      }
      dir = path.dirname(dir);
    }
    throw error;
  }
}
const nuxt = from(at('examples/nuxt-starter/package.json'), 'nuxt');
const nitro = from(from(nuxt, '@nuxt/nitro-server'), 'nitropack');
const nft = from(nitro, '@vercel/nft');
const archive = from(nitro, 'archiver');
const globPaths = [from(nft, 'glob')];
const forgePath = from(from(nitro, 'listhen'), 'node-forge');
const loaded = (manifest) => createRequire(manifest)(JSON.parse(readFileSync(manifest)).name);
const version = (manifest) => JSON.parse(readFileSync(manifest)).version;
function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'lingva-glob-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const file of ['src/one.ts', 'src/deep/two.ts', 'src/skip.js', '.hidden.ts', 'node_modules/skip.ts']) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), 'synthetic');
  }
  return dir;
}

test('the entire resolved graph excludes affected glob/minimatch/forge releases', () => {
  const graphs = parseAllDocuments(readFileSync(at('pnpm-lock.yaml'), 'utf8')).map((doc) => {
    assert.deepEqual(doc.errors, []);
    return doc.toJSON();
  });
  let checked = 0;
  for (const graph of graphs)
    for (const name of Object.keys(graph.packages ?? {})) {
      const match = /^(glob|minimatch|node-forge)@(\d+\.\d+\.\d+)$/.exec(name);
      if (!match) continue;
      const major = Number(match[2].split('.')[0]);
      if (match[1] === 'glob' && major >= 9) {
        assert.equal(match[2], '14.0.2');
        checked++;
      }
      if (match[1] === 'minimatch' && major >= 7) {
        assert.equal(match[2], '11.0.1');
        checked++;
      }
      if (match[1] === 'node-forge') {
        assert.equal(match[2], '1.4.1');
        checked++;
      }
    }
  assert.ok(checked >= 3);
  assert.equal(version(nuxt), '4.6.3');
});

for (const [i, manifest] of globPaths.entries())
  test(`installed glob consumer${i} retains Promise and sync matching`, async (t) => {
    const dir = fixture(t),
      api = loaded(manifest);
    assert.equal(version(manifest), '14.0.2');
    const opts = { cwd: dir, dot: true, nodir: true, mark: true, ignore: '**/node_modules/**/*' };
    const expected = ['.hidden.ts', 'src/deep/two.ts', 'src/one.ts'];
    assert.deepEqual((await api.glob('**/*.ts', opts)).sort(), expected);
    assert.deepEqual(api.sync('**/*.ts', opts).sort(), expected);
  });

test('installed Nitro archiver creates filtered ZIP entries through its glob interface', async (t) => {
  const dir = fixture(t);
  const { ZipArchive } = await import(pathToFileURL(createRequire(nitro).resolve('archiver')));
  assert.equal(version(archive), '8.0.0');
  const zip = new ZipArchive({ store: true }),
    chunks = [],
    names = [];
  const complete = new Promise((resolve, reject) => zip.once('end', resolve).once('error', reject));
  zip.on('entry', (entry) => names.push(entry.name));
  zip.on('data', (chunk) => chunks.push(chunk));
  zip.glob('src/**/*.ts', { cwd: dir, ignore: ['src/deep/**'] });
  await zip.finalize();
  await complete;
  assert.deepEqual(names, ['src/one.ts']);
  assert.equal(Buffer.concat(chunks).subarray(0, 4).toString('hex'), '504b0304');
});

test('aborting the installed async glob stops further directory reads', async (t) => {
  const dir = fixture(t),
    api = loaded(globPaths[0]),
    controller = new AbortController();
  let calls = 0;
  const reason = new Error('synthetic cancellation');
  const fs = {
    readdir(...args) {
      calls++;
      if (calls === 1) controller.abort(reason);
      return readdir(...args);
    },
  };
  await assert.rejects(api.glob('**/*', { cwd: dir, signal: controller.signal, fs }), (error) => error === reason);
  const atRejection = calls;
  await delay(50);
  assert.equal(calls, atRejection);
});

test('installed matcher retains TypeScript and Vue attribute matching forms', () => {
  const parser = from(at('packages/eslint-config/package.json'), '@typescript-eslint/parser');
  const estree = from(parser, '@typescript-eslint/typescript-estree');
  const builder = from(nuxt, '@nuxt/vite-builder');
  const vue = from(from(from(builder, 'vite-plugin-checker'), 'vue-tsc'), '@vue/language-core');
  for (const parent of [estree, vue]) {
    const manifest = from(parent, 'minimatch'),
      api = loaded(manifest);
    assert.equal(version(manifest), '11.0.1');
    assert.equal(api.minimatch('.config.ts', '*.ts', { dot: true }), true);
    assert.equal(api.minimatch('data-testid', 'data-*'), true);
    assert.equal(api.minimatch('aria-label', 'data-*'), false);
    assert.equal(new api.Minimatch('src/**/*.ts').match('src/deep/view.ts'), true);
    assert.equal(api.minimatch('src/view.js', 'src/**/*.ts'), false);
  }
});

test('malformed PEM parsing is bounded in an isolated child', () => {
  const entry = createRequire(forgePath).resolve('node-forge');
  const code = `const a=require('node:assert/strict'),f=require(process.argv[1]);a.throws(()=>f.pem.decode('-----BEGIN SYNTHETIC-----\\n'+'\\n'.repeat(29000)));`;
  const result = spawnSync(process.execPath, ['-e', code, entry], { timeout: 2000, encoding: 'utf8' });
  assert.equal(result.error, undefined, 'PEM parser exceeded the owned child budget');
  assert.equal(result.status, 0, result.stderr);
});

test('the fixed forge keeps valid RSA signatures and rejects nested DigestInfo extras', () => {
  const forge = loaded(forgePath);
  assert.equal(version(forgePath), '1.4.1');
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKey = forge.pki.privateKeyFromPem(keys.privateKey.export({ type: 'pkcs1', format: 'pem' }));
  const publicKey = forge.pki.publicKeyFromPem(keys.publicKey.export({ type: 'spki', format: 'pem' }));
  const md = forge.md.sha256.create();
  md.update('synthetic signature compatibility');
  const signature = privateKey.sign(md);
  assert.equal(publicKey.verify(md.digest().bytes(), signature), true);
  const asn = forge.asn1,
    U = asn.Class.UNIVERSAL,
    T = asn.Type;
  const algorithm = asn.create(U, T.SEQUENCE, true, [
    asn.create(U, T.OID, false, asn.oidToDer(forge.pki.oids.sha256).getBytes()),
    asn.create(U, T.NULL, false, ''),
    asn.create(U, T.NULL, false, ''),
  ]);
  const digestInfo = asn.create(U, T.SEQUENCE, true, [
    algorithm,
    asn.create(U, T.OCTETSTRING, false, md.digest().bytes()),
  ]);
  const malformed = privateKey.sign(asn.toDer(digestInfo).getBytes(), 'NONE');
  assert.throws(() => publicKey.verify(md.digest().bytes(), malformed), /DigestInfo/);
});

test('retiring forge mitigation adds no advisory exceptions and preserves deepmerge protection', () => {
  const config = parse(readFileSync(at('pnpm-workspace.yaml'), 'utf8'));
  assert.equal(config.patchedDependencies['node-forge@1.4.0'], undefined);
  assert.equal(config.patchedDependencies['deepmerge@4.3.1'], 'patches/deepmerge@4.3.1.patch');
  assert.deepEqual(config.auditConfig.ignoreGhsas, ['GHSA-vfj7-8cjw-p6xm', 'GHSA-gcqx-w48m-w2h4']);
});
