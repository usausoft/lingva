import { createLingvaResources, defineLingvaProject } from '@lingva/core';

const resources = createLingvaResources({
  en: {
    'dashboard.title': 'App two dashboard',
  },
  de: {
    'dashboard.title': 'App zwei Dashboard',
  },
});

export default defineLingvaProject({
  resources,
  defaultLocale: 'en',
  fallbackLocale: 'en',
});
