import { createLingvaResources, defineLingvaProject } from '@lingva/core';
import enLocale from '../translations/en.json';
import ruLocale from '../translations/ru.json';

export const resources = createLingvaResources({
  en: enLocale,
  ru: ruLocale,
});

export const project = defineLingvaProject({
  projectId: 'next-starter',
  resources,
  defaultLocale: 'en',
  fallbackLocale: 'en',
  keyMetadata: {
  "app.badge": {
    "description": "Small product label above the starter hero headline.",
    "namespace": "app",
    "reviewer": "starter@lingva.dev",
    "status": "approved",
    "tags": [
      "starter",
      "marketing"
    ],
    "translator": "starter@lingva.dev"
  },
  "app.cta": {
    "description": "Primary starter call-to-action linking to Lingva documentation.",
    "namespace": "app",
    "reviewer": "starter@lingva.dev",
    "status": "approved",
    "tags": [
      "starter",
      "cta"
    ],
    "translator": "starter@lingva.dev"
  },
  "app.locale": {
    "description": "Accessible label for the locale switcher.",
    "namespace": "app",
    "reviewer": "starter@lingva.dev",
    "status": "approved",
    "tags": [
      "starter",
      "locale"
    ],
    "translator": "starter@lingva.dev"
  },
  "app.subtitle": {
    "description": "Hero paragraph explaining the local-first Next.js integration path.",
    "namespace": "app",
    "reviewer": "starter@lingva.dev",
    "status": "approved",
    "tags": [
      "starter",
      "marketing"
    ],
    "translator": "starter@lingva.dev"
  },
  "app.title": {
    "description": "Main hero headline for the Next.js starter.",
    "namespace": "app",
    "reviewer": "starter@lingva.dev",
    "status": "approved",
    "tags": [
      "starter",
      "marketing"
    ],
    "translator": "starter@lingva.dev"
  },
  "cards.config.body": {
    "description": "Feature card body explaining config-first local setup.",
    "namespace": "cards",
    "reviewer": "starter@lingva.dev",
    "status": "approved",
    "tags": [
      "starter",
      "feature-card"
    ],
    "translator": "starter@lingva.dev"
  },
  "cards.config.title": {
    "description": "Feature card title for config-first setup.",
    "namespace": "cards",
    "reviewer": "starter@lingva.dev",
    "status": "approved",
    "tags": [
      "starter",
      "feature-card"
    ],
    "translator": "starter@lingva.dev"
  },
  "cards.delivery.body": {
    "description": "Feature card body explaining local-to-hosted delivery migration.",
    "namespace": "cards",
    "reviewer": "starter@lingva.dev",
    "status": "approved",
    "tags": [
      "starter",
      "feature-card"
    ],
    "translator": "starter@lingva.dev"
  },
  "cards.delivery.title": {
    "description": "Feature card title for hosted delivery readiness.",
    "namespace": "cards",
    "reviewer": "starter@lingva.dev",
    "status": "approved",
    "tags": [
      "starter",
      "feature-card"
    ],
    "translator": "starter@lingva.dev"
  },
  "cards.typing.body": {
    "description": "Feature card body explaining typed runtime usage.",
    "namespace": "cards",
    "reviewer": "starter@lingva.dev",
    "status": "approved",
    "tags": [
      "starter",
      "feature-card"
    ],
    "translator": "starter@lingva.dev"
  },
  "cards.typing.title": {
    "description": "Feature card title for typed runtime support.",
    "namespace": "cards",
    "reviewer": "starter@lingva.dev",
    "status": "approved",
    "tags": [
      "starter",
      "feature-card"
    ],
    "translator": "starter@lingva.dev"
  }
},
});

export default project;
