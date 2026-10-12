#!/usr/bin/env node
/** Reject private operator implementations and source maps in public build output. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const PRIVATE_IMPLEMENTATION =
  /serveLingvaLocalRemote|dispatchLingvaLocalRemoteRequest|checkLingvaLocalRemoteEnvironment|runLingvaLocalRemoteSmoke|@lingva\/(?:platform-cli|infrastructure-aws|local-env)/u;
const PRIVATE_ENTRY = /(?:^|\/)(?:platform-launcher|legacy-cli)\.[cm]?[jt]s$/u;

export async function verifyPublicBuild(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await verifyPublicBuild(file);
      continue;
    }
    assert.ok(!PRIVATE_ENTRY.test(file.replaceAll(path.sep, '/')), `Private entry point in public output: ${file}`);
    assert.ok(!entry.name.endsWith('.map'), `Source map in public output: ${file}`);
    if (/\.[cm]?[jt]s$/u.test(entry.name)) {
      const content = await fs.readFile(file, 'utf8');
      assert.ok(!PRIVATE_IMPLEMENTATION.test(content), `Private implementation in public output: ${file}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  assert.ok(process.argv.length > 2, 'Usage: node scripts/verify-public-boundary.mjs <dist-dir> [...]');
  for (const directory of process.argv.slice(2)) await verifyPublicBuild(directory);
}
