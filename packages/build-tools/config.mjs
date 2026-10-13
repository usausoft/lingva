import process from 'node:process';
import { defineConfig } from 'tsdown';

const isDeveloperBuild = process.env.LINGVA_DEV_BUILD === 'true';

/** @param {import('tsdown').Options} config */
export function defineLingvaPackageBuildConfig(config) {
  return defineConfig({ ...config, clean: true, minify: !isDeveloperBuild, sourcemap: isDeveloperBuild });
}
