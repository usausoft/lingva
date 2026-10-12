import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('build wrapper launches the package-local tsdown CLI without a command shim', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva build fixture '));
  try {
    const dependency = path.join(root, 'node_modules/tsdown');
    await fs.mkdir(dependency, { recursive: true });
    await fs.writeFile(path.join(root, 'package.json'), '{"private":true,"type":"module"}');
    // No bin entry or pnpm shim: only resolving the dependency's public CLI
    // entrypoint can work, including when the package path contains spaces.
    await fs.writeFile(
      path.join(dependency, 'package.json'),
      '{"name":"tsdown","type":"module","exports":{"./run":"./run.mjs"}}'
    );
    await fs.writeFile(
      path.join(dependency, 'run.mjs'),
      'import fs from "node:fs/promises"; await fs.mkdir("dist"); await fs.writeFile("dist/index.mjs", "export const built = true;\\n"); await fs.writeFile("dist/index.mjs.map", "{}");'
    );
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./build-package.mjs', import.meta.url))], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(await fs.readFile(path.join(root, 'dist/index.mjs'), 'utf8'), /built = true/u);
    assert.equal((await fs.readdir(root)).includes('.lingva-build.lock'), false);
    assert.equal((await fs.readdir(path.join(root, 'dist'))).includes('index.mjs.map'), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
