import { config as reactConfig } from '@lingva/eslint-config/react-internal';

/** @type {import("eslint").Linter.Config} */
export default [
  {
    ignores: ['build/**', '.docusaurus/**'],
  },
  ...reactConfig,
];
