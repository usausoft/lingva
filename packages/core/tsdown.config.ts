import { defineLingvaPackageBuildConfig } from '../../tsdown.shared.ts';

export default defineLingvaPackageBuildConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
});
