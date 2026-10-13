#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

async function collectFiles(targetPath) {
  const stats = await fs.stat(targetPath);

  if (stats.isFile()) {
    return [targetPath];
  }

  if (!stats.isDirectory()) {
    return [];
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(targetPath, entry.name);

      if (entry.isDirectory()) {
        return collectFiles(entryPath);
      }

      if (entry.isFile()) {
        return [entryPath];
      }

      return [];
    })
  );

  return files.flat();
}

async function stripSourceMapReference(filePath) {
  let content = await fs.readFile(filePath, 'utf8');
  content = content.replace(/\n\/\/# sourceMappingURL=.*$/u, '');
  await fs.writeFile(filePath, content, 'utf8');
}

async function main() {
  if (process.env.LINGVA_DEV_BUILD === 'true') {
    process.exit(0);
  }

  const distPath = process.argv[2];

  if (!distPath) {
    console.error('Usage: node scripts/protect-build.mjs <dist-dir>');
    process.exit(1);
  }

  const absoluteDistPath = path.resolve(process.cwd(), distPath);
  const files = await collectFiles(absoluteDistPath);

  await Promise.all(
    files.map(async (filePath) => {
      if (filePath.endsWith('.map')) {
        await fs.rm(filePath, { force: true });
        return;
      }

      if (/\.(?:[cm]?[jt]s)$/u.test(filePath)) {
        await stripSourceMapReference(filePath);
      }
    })
  );
}

void main();
