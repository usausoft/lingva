import { defineConfig, type Options } from 'tsdown';

const isDeveloperBuild = process.env.LINGVA_DEV_BUILD === 'true';

export function defineLingvaPackageBuildConfig(config: Omit<Options, 'minify' | 'sourcemap' | 'clean'>) {
  return defineConfig({
    ...config,
    clean: true,
    minify: !isDeveloperBuild,
    sourcemap: isDeveloperBuild,
  });
}
