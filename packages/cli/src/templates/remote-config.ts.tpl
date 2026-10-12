import { defineLingvaConfig } from '@lingva/core';

const lingvaConfig = defineLingvaConfig({
  projectId: {{PROJECT_ID}},
  environment: {{ENVIRONMENT}},
  locales: {{LOCALES}},
  defaultLocale: {{DEFAULT_LOCALE}},
  locale: {{DEFAULT_LOCALE}},
  fallbackLocale: {{FALLBACK_LOCALE}},
  apiUrl: {{API_URL}},
  apiKey: process.env{{API_KEY_ENV_ACCESS}},
  delivery: {
    mode: 'cdn',
    url: {{BUNDLE_URL}},
  },
});

export default lingvaConfig;
