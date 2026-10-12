import { createLingvaResources, defineLingvaConfig, defineLingvaProject } from '@lingva/core';

const resources = createLingvaResources({
  en: {
    'hero.title': 'Lingva TS config demo',
    'hero.subtitle': 'Loaded from lingva.ts for CLI and runtime examples.',
  },
  de: {
    'hero.title': 'Lingva TS Konfiguration Demo',
  },
});

const project = defineLingvaProject({
  resources,
  defaultLocale: 'en',
  fallbackLocale: 'en',
  projectId: 'demo-ts-config',
  environment: 'development',
  keyMetadata: {
    'hero.title': {
      description: 'Headline shown in the TypeScript config fixture.',
      namespace: 'hero',
      status: 'draft',
    },
  },
});

export default defineLingvaConfig({
  project,
  locale: 'en',
  delivery: {
    mode: 'local',
    path: './locales/{locale}.json',
  },
  cli: {
    validate: {
      failOn: 'error',
    },
    validatePolicies: {
      strict: {
        failOn: 'warning',
      },
    },
  },
});

export { project };
