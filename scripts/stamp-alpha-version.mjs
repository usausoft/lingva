#!/usr/bin/env node

/**
 * Stamps a prerelease suffix onto the version field of each publishable package
 * so that alpha builds don't shadow the stable `latest` dist-tag on the registry.
 *
 * Usage: node scripts/stamp-alpha-version.mjs <label>
 * Example: node scripts/stamp-alpha-version.mjs abc1234
 * Result: "0.0.1" → "0.0.1-alpha.abc1234"
 *
 * Runs only in CI (LINGVA_DEV_BUILD is not set). Changes are never committed —
 * the modified package.json files exist only for the duration of the publish step.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { PUBLIC_PACKAGE_DIRECTORIES } from './public-packages.mjs';

const root = path.resolve(fileURLToPath(import.meta.url), '../../');
const label = process.argv[2];

if (!label) {
  console.error('Usage: node scripts/stamp-alpha-version.mjs <label>');
  process.exit(1);
}

for (const pkg of PUBLIC_PACKAGE_DIRECTORIES) {
  const pkgPath = path.join(root, pkg, 'package.json');
  const raw = await fs.readFile(pkgPath, 'utf8');
  const manifest = JSON.parse(raw);
  const base = manifest.version.split('-')[0];
  manifest.version = `${base}-alpha.${label}`;
  await fs.writeFile(pkgPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`${manifest.name}: ${manifest.version}`);
}
