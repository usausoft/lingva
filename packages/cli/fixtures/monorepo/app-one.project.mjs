import { createLingvaResources, defineLingvaProject } from '@lingva/core';

const resources = createLingvaResources({
  en: {
    'hero.title': 'App one',
    'hero.subtitle': 'First demo project',
  },
  fr: {
    'hero.title': 'Application un',
  },
});

export default defineLingvaProject({
  resources,
  defaultLocale: 'en',
  fallbackLocale: 'en',
  keyMetadata: {
    'hero.title': {
      description: 'Primary title for app one.',
      namespace: 'hero',
    },
  },
});
