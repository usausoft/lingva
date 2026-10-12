#!/usr/bin/env node

import { spawn } from 'node:child_process';
import process from 'node:process';
import { PUBLIC_PACKAGE_NAMES } from './public-packages.mjs';

const PACKAGE_MANAGER_COMMAND = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const filters = PUBLIC_PACKAGE_NAMES.map((packageName) => `--filter=${packageName}`);
const child = spawn(PACKAGE_MANAGER_COMMAND, ['exec', 'turbo', 'run', 'build', ...filters], {
  stdio: 'inherit',
});

child.once('error', (cause) => {
  console.error(cause);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  if (code === 0) {
    return;
  }

  console.error(`Public package build failed with ${signal ?? `exit code ${code}`}.`);
  process.exitCode = code ?? 1;
});
