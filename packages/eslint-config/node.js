import globals from 'globals';

import { config as baseConfig } from './base.js';

/**
 * Shared configuration for Node.js applications and repository tooling.
 * Browser globals remain opt-in through the React configurations so accidental
 * use of platform-specific APIs is still reported.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export const nodeFileConfig = {
  files: ['**/scripts/**/*.{cjs,js,mjs,ts}', '**/*.{config,setup}.{cjs,js,mjs,ts}'],
  languageOptions: {
    globals: {
      ...globals.node,
      // ESM tooling imports `node:process` explicitly. Marking the legacy
      // global unavailable catches accidental implicit process coupling.
      process: 'off',
    },
  },
};

export const nodeConfig = [...baseConfig, { ...nodeFileConfig, files: ['**/*.{cjs,js,mjs,ts,tsx}'] }];
