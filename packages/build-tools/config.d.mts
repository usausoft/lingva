import type { Options } from 'tsdown';
export declare function defineLingvaPackageBuildConfig(
  config: Omit<Options, 'minify' | 'sourcemap' | 'clean'>
): Options;
