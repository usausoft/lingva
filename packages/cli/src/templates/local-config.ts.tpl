import { defineLingvaConfig } from '@lingva/core';

const lingvaConfig = defineLingvaConfig({
  projectId: {{PROJECT_ID}},
  locales: {{LOCALES}},
  defaultLocale: {{DEFAULT_LOCALE}},
  locale: {{DEFAULT_LOCALE}},
  fallbackLocale: {{FALLBACK_LOCALE}},
  translationFiles: {{TRANSLATION_FILES}},
  generatedProjectFile: {{GENERATED_PROJECT_FILE}},
  metadataFile: {{METADATA_FILE}},
  delivery: {
    mode: 'local',
    path: {{TRANSLATION_FILES}},
  },
});

export default lingvaConfig;
