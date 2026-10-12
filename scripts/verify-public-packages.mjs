#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { PUBLIC_PACKAGE_DIRECTORIES, PUBLIC_PACKAGE_NAMES } from './public-packages.mjs';
import { verifyPublicBuild } from './verify-public-boundary.mjs';

const PACKAGE_MANAGER_COMMAND = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const REPOSITORY_URL = 'git+https://github.com/usausoft/lingva.git';
const REGISTRY_URL = 'https://registry.npmjs.org';
const SDK_LICENSE_DECLARATION = 'SEE LICENSE IN LICENSE.md';
const root = path.resolve(fileURLToPath(import.meta.url), '../../');

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      env: options.env ?? process.env,
      stdio: 'inherit',
    });
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

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function tarballName(manifest) {
  return `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`;
}

async function assertPackageMetadata(directory, expectedLicense) {
  const absoluteDirectory = path.join(root, directory);
  const manifest = await readJson(path.join(absoluteDirectory, 'package.json'));
  const packageName = `@lingva/${path.basename(directory)}`;

  assert.equal(manifest.name, packageName);
  assert.equal(manifest.private, undefined, `${packageName} must not be private.`);
  assert.equal(manifest.license, SDK_LICENSE_DECLARATION);
  assert.equal(manifest.publishConfig?.access, 'public');
  assert.equal(manifest.publishConfig?.provenance, true);
  assert.equal(manifest.publishConfig?.registry, REGISTRY_URL);
  assert.equal(manifest.repository?.url, REPOSITORY_URL);
  assert.equal(manifest.repository?.directory, directory);
  assert.ok(manifest.description, `${packageName} requires a description.`);
  assert.ok(manifest.homepage, `${packageName} requires a homepage.`);
  assert.ok(manifest.bugs?.url, `${packageName} requires a bug-report URL.`);
  assert.ok(manifest.keywords?.length, `${packageName} requires search keywords.`);
  assert.equal(await fs.readFile(path.join(absoluteDirectory, 'LICENSE.md'), 'utf8'), expectedLicense);
  await fs.access(path.join(absoluteDirectory, 'README.md'));

  for (const dependencyName of Object.keys(manifest.dependencies ?? {})) {
    assert.ok(
      !dependencyName.startsWith('@lingva/') || PUBLIC_PACKAGE_NAMES.includes(dependencyName),
      `${packageName} depends on unpublished workspace package ${dependencyName}.`
    );
  }

  return manifest;
}

async function assertInstalledPackage(consumerDirectory, packageName, expectedLicense) {
  const packageDirectory = path.join(consumerDirectory, 'node_modules', packageName);
  const manifest = await readJson(path.join(packageDirectory, 'package.json'));

  assert.equal(manifest.private, undefined, `${packageName} was packed as private.`);
  assert.equal(manifest.publishConfig?.access, 'public');
  assert.equal(await fs.readFile(path.join(packageDirectory, 'LICENSE.md'), 'utf8'), expectedLicense);
  await fs.access(path.join(packageDirectory, 'README.md'));
  await verifyPublicBuild(path.join(packageDirectory, 'dist'));
}

async function main() {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-public-packages-'));
  const tarballDirectory = path.join(temporaryDirectory, 'tarballs');
  const consumerDirectory = path.join(temporaryDirectory, 'consumer');
  const expectedLicense = await fs.readFile(path.join(root, 'SDK-LICENSE.md'), 'utf8');

  try {
    await fs.mkdir(tarballDirectory, { recursive: true });
    const manifests = await Promise.all(
      PUBLIC_PACKAGE_DIRECTORIES.map((directory) => assertPackageMetadata(directory, expectedLicense))
    );

    for (const directory of PUBLIC_PACKAGE_DIRECTORIES) {
      await run(PACKAGE_MANAGER_COMMAND, ['--dir', directory, 'pack', '--pack-destination', tarballDirectory]);
    }

    const packageDependencies = Object.fromEntries(
      manifests.map((manifest) => [manifest.name, `file:${path.join(tarballDirectory, tarballName(manifest))}`])
    );
    const packageOverrides = Object.entries(packageDependencies)
      .map(([packageName, dependency]) => `  ${JSON.stringify(packageName)}: ${JSON.stringify(dependency)}`)
      .join('\n');
    await fs.mkdir(consumerDirectory, { recursive: true });
    await fs.writeFile(
      path.join(consumerDirectory, 'package.json'),
      `${JSON.stringify(
        {
          name: 'lingva-packed-package-smoke',
          private: true,
          type: 'module',
          dependencies: {
            ...packageDependencies,
            '@angular/core': '22.1.6',
            '@types/react': '19.3.0',
            '@types/react-dom': '19.2.3',
            react: '19.2.4',
            'react-dom': '19.2.4',
            svelte: '5.57.0',
            typescript: '5.9.3',
            vue: '3.5.42',
          },
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    await fs.writeFile(
      path.join(consumerDirectory, 'pnpm-workspace.yaml'),
      // pnpm 11+ reads workspace policy from pnpm-workspace.yaml. Resolving every
      // Lingva dependency from its tarball keeps this smoke test independent of
      // whichever package versions already exist in the public registry.
      `packages: []\noverrides:\n${packageOverrides}\n`,
      'utf8'
    );
    await fs.writeFile(
      path.join(consumerDirectory, 'smoke.mjs'),
      `${PUBLIC_PACKAGE_NAMES.map((name, index) => `import * as package${index} from '${name}';`).join('\n')}\n\n` +
        `const packages = [${PUBLIC_PACKAGE_NAMES.map((_, index) => `package${index}`).join(', ')}];\n` +
        `if (packages.some((entry) => Object.keys(entry).length === 0)) throw new Error('A Lingva package exported no symbols.');\n`,
      'utf8'
    );
    await fs.writeFile(
      path.join(consumerDirectory, 'smoke.cjs'),
      `'use strict';\nconst packages = ${JSON.stringify(PUBLIC_PACKAGE_NAMES)}.map((name) => require(name));\n` +
        `if (packages.some((entry) => Object.keys(entry).length === 0)) throw new Error('A Lingva package exported no symbols.');\n`,
      'utf8'
    );
    await fs.writeFile(
      path.join(consumerDirectory, 'types.ts'),
      `${PUBLIC_PACKAGE_NAMES.map((name, index) => `import * as package${index} from '${name}';`).join('\n')}\n` +
        `export const packageExportCounts = [${PUBLIC_PACKAGE_NAMES.map((_, index) => `package${index}`).join(', ')}].map((entry) => Object.keys(entry).length);\n`,
      'utf8'
    );
    await fs.writeFile(
      path.join(consumerDirectory, 'tsconfig.json'),
      `${JSON.stringify(
        {
          compilerOptions: {
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            noEmit: true,
            skipLibCheck: false,
            strict: true,
            target: 'ES2022',
          },
          include: ['types.ts'],
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    await run(PACKAGE_MANAGER_COMMAND, ['install', '--prefer-offline', '--ignore-scripts'], {
      cwd: consumerDirectory,
    });
    await Promise.all(
      PUBLIC_PACKAGE_NAMES.map((packageName) => assertInstalledPackage(consumerDirectory, packageName, expectedLicense))
    );
    await run(process.execPath, ['smoke.mjs'], { cwd: consumerDirectory });
    await run(process.execPath, ['smoke.cjs'], { cwd: consumerDirectory });
    await run(PACKAGE_MANAGER_COMMAND, ['exec', 'tsc', '--project', 'tsconfig.json'], { cwd: consumerDirectory });
    // Native execution and archive installation are proved by CLI release gates.
    // This SDK gate verifies public packaging without requiring a source Rust workspace.
    const cliDirectory = path.join(consumerDirectory, 'node_modules/@lingva/cli');
    const cliManifest = await readJson(path.join(cliDirectory, 'package.json'));
    assert.deepEqual(cliManifest.bin, { lingva: './dist/native-launcher.mjs' });
  } finally {
    await fs.rm(temporaryDirectory, { force: true, recursive: true });
  }
}

void main().catch((cause) => {
  console.error(cause);
  process.exitCode = 1;
});
