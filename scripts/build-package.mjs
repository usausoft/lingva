#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const BUILD_LOCK_FILE = '.lingva-build.lock';
const BUILD_LOCK_RETRY_MS = 100;
const BUILD_LOCK_METADATA = 'owner.json';
const STALE_LOCK_METADATA_MS = 60_000;
const CLI_TEMPLATE_FLAG = '--copy-cli-templates';
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

function wait(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

async function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (cause) {
    return cause?.code !== 'ESRCH';
  }
}

async function clearStaleLock(lockPath) {
  try {
    const value = JSON.parse(await fs.readFile(path.join(lockPath, BUILD_LOCK_METADATA), 'utf8'));

    if (!Number.isInteger(value.pid) || !(await isProcessRunning(value.pid))) {
      await fs.rm(lockPath, { force: true, recursive: true });
    }
  } catch (cause) {
    if (cause?.code === 'ENOENT') {
      return;
    }

    const stats = await fs.stat(lockPath).catch(() => null);
    if (stats && Date.now() - stats.mtimeMs > STALE_LOCK_METADATA_MS) {
      await fs.rm(lockPath, { force: true, recursive: true });
    }
  }
}

async function acquireBuildLock(lockPath) {
  const token = randomUUID();
  const value = JSON.stringify({ pid: process.pid, token });

  while (true) {
    try {
      await fs.mkdir(lockPath);
      await fs.writeFile(path.join(lockPath, BUILD_LOCK_METADATA), value, 'utf8');
      return token;
    } catch (cause) {
      if (cause?.code !== 'EEXIST') {
        throw cause;
      }

      await clearStaleLock(lockPath);
      await wait(BUILD_LOCK_RETRY_MS);
    }
  }
}

async function releaseBuildLock(lockPath, token) {
  try {
    const current = JSON.parse(await fs.readFile(path.join(lockPath, BUILD_LOCK_METADATA), 'utf8'));
    if (current.token === token) {
      await fs.rm(lockPath, { force: true, recursive: true });
    }
  } catch (cause) {
    if (cause?.code !== 'ENOENT') {
      throw cause;
    }
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with ${signal ?? `code ${code}`}.`));
    });
  });
}

async function main() {
  const lockPath = path.join(process.cwd(), BUILD_LOCK_FILE);
  const token = await acquireBuildLock(lockPath);

  try {
    // Launch the package's own CLI with Node: Windows cannot directly spawn
    // a .cmd shim, and shell interpolation would break paths containing spaces.
    const require = createRequire(path.join(process.cwd(), 'package.json'));
    await run(process.execPath, [require.resolve('tsdown/run')]);

    if (process.argv.includes(CLI_TEMPLATE_FLAG)) {
      await run(process.execPath, [path.join(scriptDirectory, 'copy-cli-templates.mjs')]);
    }

    await run(process.execPath, [path.join(scriptDirectory, 'protect-build.mjs'), 'dist']);
  } finally {
    await releaseBuildLock(lockPath, token);
  }
}

void main().catch((cause) => {
  console.error(cause);
  process.exitCode = 1;
});
