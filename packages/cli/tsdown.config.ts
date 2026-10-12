import { defineLingvaPackageBuildConfig } from '../../tsdown.shared.ts';

export default defineLingvaPackageBuildConfig({
  entry: ['src/index.ts', 'src/cli.ts', 'src/native-launcher.ts'],
  format: ['cjs', 'esm'],
  dts: true,
});
