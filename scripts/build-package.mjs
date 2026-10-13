#!/usr/bin/env node
import process from 'node:process';
import { runPackageBuild } from '../packages/build-tools/build-package.mjs';

const copyTemplates = process.argv.includes('--copy-cli-templates')
  ? async () => {
      await import('./copy-cli-templates.mjs');
    }
  : undefined;

void runPackageBuild({ copyTemplates }).catch((cause) => {
  console.error(cause);
  process.exitCode = 1;
});
