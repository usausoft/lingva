import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verifyPublicBuild } from './verify-public-boundary.mjs';

test('public output gate rejects operator code and source maps, including nested chunks', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-public-boundary-'));
  try {
    const chunks = path.join(directory, 'chunks');
    await fs.mkdir(chunks);
    const file = path.join(chunks, 'index.mjs');
    await fs.writeFile(file, 'export const sdk = true;');
    await verifyPublicBuild(directory);
    await fs.writeFile(file, 'export function serveLingvaLocalRemote() {}');
    await assert.rejects(verifyPublicBuild(directory), /Private implementation/u);
    await fs.writeFile(file, 'export const sdk = true;');
    await fs.writeFile(path.join(chunks, 'platform-launcher.mjs'), 'console.log("operator");');
    await assert.rejects(verifyPublicBuild(directory), /Private entry point/u);
    await fs.rm(path.join(chunks, 'platform-launcher.mjs'));
    await fs.writeFile(path.join(chunks, 'index.mjs.map'), '{"sourcesContent":["source"]}');
    await assert.rejects(verifyPublicBuild(directory), /Source map/u);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
