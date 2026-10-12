import { createLingvaResources, defineLingvaProject } from '@lingva/core';
import enLocale from '../translations/en.json';
import ruLocale from '../translations/ru.json';

export const resources = createLingvaResources({ en: enLocale, ru: ruLocale });

export default defineLingvaProject({
  projectId: 'sveltekit-starter',
  resources,
  defaultLocale: 'en',
  fallbackLocale: 'en',
});
