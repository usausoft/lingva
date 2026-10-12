import { defineLingvaPackageBuildConfig } from '../../tsdown.shared.ts';

export default defineLingvaPackageBuildConfig({ entry: ['src/index.ts'], dts: true, format: ['esm', 'cjs'] });
