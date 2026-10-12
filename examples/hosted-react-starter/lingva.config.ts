import { LINGVA_DELIVERY_MODES, defineLingvaConfig } from '@lingva/core';

// import.meta.env is the Vite env object in browser context; undefined in Node.js CLI context.
// Fallback to {} so CLI commands (push, sync, check) work without delivery env vars.
const env: Partial<ImportMetaEnv> = import.meta.env ?? {};

// Set VITE_LINGVA_DELIVERY_MODE=hosted and provide VITE_LINGVA_BUNDLE_URL + VITE_LINGVA_API_KEY
// to consume translation bundles from the hosted platform instead of local files.
const STARTER_DELIVERY_MODES = { hosted: 'hosted', local: 'local' } as const;
const deliveryMode =
  env.VITE_LINGVA_DELIVERY_MODE === STARTER_DELIVERY_MODES.hosted
    ? STARTER_DELIVERY_MODES.hosted
    : STARTER_DELIVERY_MODES.local;
const bundleUrl = env.VITE_LINGVA_BUNDLE_URL ?? '';
const apiKey = env.VITE_LINGVA_API_KEY ?? '';

const lingvaConfig = defineLingvaConfig({
  projectId: 'hosted-react-starter',
  locales: ['en', 'ru'],
  defaultLocale: 'en',
  locale: 'en',
  fallbackLocale: 'en',
  translationFiles: '.lingva/translations/{locale}.json',
  generatedProjectFile: '.lingva/generated/project.ts',
  ...(apiKey ? { apiKey } : {}),
  delivery:
    deliveryMode === STARTER_DELIVERY_MODES.hosted && bundleUrl
      ? { mode: LINGVA_DELIVERY_MODES.cdn, url: bundleUrl }
      : {
          mode: LINGVA_DELIVERY_MODES.local,
          path: '.lingva/translations/{locale}.json',
        },
});

export default lingvaConfig;
