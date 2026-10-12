import { LINGVA_DELIVERY_MODES, defineLingvaConfig } from '@lingva/core';

// Consumer plane: this starter defaults to fully-local delivery (reads translation
// files directly — no backend needed).
//   LINGVA_DELIVERY_MODE=hosted-local  → local Lingva platform (`lingva serve` on :4578)
//   LINGVA_DELIVERY_MODE=hosted        → real hosted CDN (set LINGVA_BUNDLE_URL + LINGVA_API_KEY)
const STARTER_DELIVERY_MODES = {
  hosted: 'hosted',
  hostedLocal: 'hosted-local',
  local: 'local',
} as const;
type StarterDeliveryMode = (typeof STARTER_DELIVERY_MODES)[keyof typeof STARTER_DELIVERY_MODES];
const configuredDeliveryMode = process.env.LINGVA_DELIVERY_MODE as StarterDeliveryMode | undefined;
const deliveryMode =
  configuredDeliveryMode && Object.values(STARTER_DELIVERY_MODES).includes(configuredDeliveryMode)
    ? configuredDeliveryMode
    : STARTER_DELIVERY_MODES.local;
const bundleUrl =
  process.env.LINGVA_BUNDLE_URL ||
  (deliveryMode === STARTER_DELIVERY_MODES.hostedLocal
    ? 'http://127.0.0.1:4578/bundles/next-starter/local/latest/{locale}.bundle.json'
    : '');
const apiKey = process.env.LINGVA_API_KEY ?? '';
const hostedLocalAuthToken = process.env.LINGVA_DELIVERY_AUTH_TOKEN || 'local-secret';
const localDelivery = {
  mode: LINGVA_DELIVERY_MODES.local,
  path: '.lingva/translations/{locale}.json',
} as const;
const deliveryByMode = {
  [STARTER_DELIVERY_MODES.hosted]: bundleUrl ? { mode: LINGVA_DELIVERY_MODES.cdn, url: bundleUrl } : localDelivery,
  [STARTER_DELIVERY_MODES.hostedLocal]: {
    mode: LINGVA_DELIVERY_MODES.cdn,
    url: bundleUrl,
    headers: { Authorization: `Bearer ${hostedLocalAuthToken}` },
  },
  [STARTER_DELIVERY_MODES.local]: localDelivery,
} as const;

const lingvaConfig = defineLingvaConfig({
  projectId: 'next-starter',
  locales: ['en', 'ru'],
  defaultLocale: 'en',
  locale: 'en',
  fallbackLocale: 'en',
  translationFiles: '.lingva/translations/{locale}.json',
  generatedProjectFile: '.lingva/generated/project.ts',
  metadataFile: '.lingva/metadata.json',
  ...(apiKey && deliveryMode === STARTER_DELIVERY_MODES.hosted ? { apiKey } : {}),
  delivery: deliveryByMode[deliveryMode],
});

export default lingvaConfig;
