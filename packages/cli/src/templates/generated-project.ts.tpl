import { createLingvaResources, defineLingvaProject } from '@lingva/core';
{{IMPORT_LINES}}

export type LingvaProjectResources = {{RESOURCE_TYPE}};

export const resources = createLingvaResources({
{{LOCALE_ENTRIES}}
}) as unknown as LingvaProjectResources;

export const project = defineLingvaProject({
  projectId: {{PROJECT_ID}},
  resources,
  defaultLocale: {{DEFAULT_LOCALE}},
  fallbackLocale: {{FALLBACK_LOCALE}},
{{ENVIRONMENT_LINE}}
{{KEY_METADATA_LINE}}
});

export default project;
