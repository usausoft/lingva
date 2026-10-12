import { LINGVA_DELIVERY_MODES, defineLingvaConfig } from '@lingva/core';

export const docsLingvaLocales = ['en', 'ru'] as const;

const docsLingvaConfig = defineLingvaConfig({
  projectId: 'docs-site',
  locales: docsLingvaLocales,
  defaultLocale: 'en',
  locale: 'en',
  fallbackLocale: 'en',
  translationFiles: '.lingva/translations/{locale}.json',
  generatedProjectFile: '.lingva/generated/project.ts',
  delivery: {
    mode: LINGVA_DELIVERY_MODES.local,
    path: '.lingva/translations/{locale}.json',
  },
});

export default docsLingvaConfig;

export type DocsLingvaLocale = (typeof docsLingvaLocales)[number];
