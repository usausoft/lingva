#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepareNativeArguments } from './native-config';

const WINDOWS_PLATFORM = 'win32';
const NPM_INSTALL_CHANNEL = 'npm';
const EXECUTABLE_NAME = process.platform === WINDOWS_PLATFORM ? 'lingva.exe' : 'lingva';
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configuredBinary = process.env.LINGVA_CLI_BINARY;
const workspaceRoot = path.resolve(packageRoot, '..', '..');
const workspaceManifest = path.join(workspaceRoot, 'Cargo.toml');
const isLingvaWorkspace =
  existsSync(workspaceManifest) && readFileSync(workspaceManifest, 'utf8').includes('crates/lingva-cli');
// An explicit override is authoritative. Falling back after a typo could run a
// different engine version than CI or the caller intended.
const nativeCandidates = configuredBinary
  ? [configuredBinary]
  : [
      path.join(packageRoot, 'vendor', EXECUTABLE_NAME),
      // packageRoot is <workspace>/packages/cli in source and in the built npm package.
      ...(isLingvaWorkspace
        ? [
            path.join(workspaceRoot, 'target', 'release', EXECUTABLE_NAME),
            path.join(workspaceRoot, 'target', 'debug', EXECUTABLE_NAME),
          ]
        : []),
    ];
const nativeBinary = nativeCandidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
function run(command: string, args: string[]): number {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: { ...process.env, LINGVA_CLI_INSTALL_CHANNEL: process.env.LINGVA_CLI_INSTALL_CHANNEL ?? NPM_INSTALL_CHANNEL },
  });
  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}

if (!nativeBinary) {
  throw new Error(
    'The standalone Lingva CLI is missing. Reinstall @lingva/cli with lifecycle scripts enabled, or use the standalone installer documented at https://docs.lingva.dev/installation.'
  );
}
async function main() {
  const prepared = await prepareNativeArguments(process.argv.slice(2));
  try {
    process.exitCode = run(nativeBinary!, prepared.args);
  } finally {
    await prepared.cleanup();
  }
}
void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
