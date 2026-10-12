import { createLingvaResources, defineLingvaProject } from '@lingva/core';
import enLocale from '../translations/en.json';
import ruLocale from '../translations/ru.json';

export const resources = createLingvaResources({
  en: enLocale,
  ru: ruLocale,
});

export const project = defineLingvaProject({
  projectId: 'vue-starter',
  resources,
  defaultLocale: 'en',
  fallbackLocale: 'en',
});

export default project;
