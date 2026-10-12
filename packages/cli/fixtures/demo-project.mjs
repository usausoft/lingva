import { createLingvaResources, defineLingvaProject } from '@lingva/core';

const resources = createLingvaResources({
  en: {
    'hero.title': 'Lingva CLI demo',
    'hero.subtitle': 'Validate your project contracts locally or in CI.',
  },
  de: {
    'hero.title': 'Lingva CLI Demo',
  },
});

export default defineLingvaProject({
  resources,
  defaultLocale: 'en',
  fallbackLocale: 'en',
  keyMetadata: {
    'hero.title': {
      description: 'Headline for the CLI demo fixture.',
      namespace: 'hero',
    },
  },
});
