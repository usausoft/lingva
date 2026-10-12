import { LINGVA_DELIVERY_MODES, defineLingvaConfig } from '@lingva/core';

export default defineLingvaConfig({
  projectId: 'sveltekit-starter',
  locales: ['en', 'ru'],
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
