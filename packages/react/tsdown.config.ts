import { defineLingvaPackageBuildConfig } from '../../tsdown.shared.ts';

export default defineLingvaPackageBuildConfig({
  entry: ['src/index.tsx'],
  format: ['cjs', 'esm'],
  dts: true,
});
