import eslintConfigPrettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';

import { config as baseConfig } from './base.js';
import { nodeFileConfig } from './node.js';

/**
 * Shared Vue single-file-component configuration. The Vue parser owns the SFC
 * shell and delegates each script block to the same typed TypeScript parser used
 * throughout the rest of the repository.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export const vueConfig = [
  ...baseConfig,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        extraFileExtensions: ['.vue'],
        parser: tseslint.parser,
        projectService: true,
      },
    },
  },
  nodeFileConfig,
  // Vue's preset contains presentation rules, so restore the repository's
  // single-source-of-truth boundary: ESLint checks behavior, Prettier formats.
  eslintConfigPrettier,
];
