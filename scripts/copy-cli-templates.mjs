#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const packageRoot = path.resolve(import.meta.dirname, '../packages/cli');
const sourceDir = path.join(packageRoot, 'src/templates');
const targetDir = path.join(packageRoot, 'dist/templates');

await fs.mkdir(targetDir, { recursive: true });

const entries = await fs.readdir(sourceDir, { withFileTypes: true });
await Promise.all(
  entries
    .filter((entry) => entry.isFile())
    .map((entry) => fs.copyFile(path.join(sourceDir, entry.name), path.join(targetDir, entry.name)))
);
