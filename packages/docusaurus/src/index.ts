import { createLingvaJsRuntime, type LingvaJsRuntime } from '@lingva/js';
import type { LingvaResources, LingvaRuntimeConfig, LingvaRuntimeSetup } from '@lingva/core';

export { createLingvaJsRuntime } from '@lingva/js';
export type * from '@lingva/js';

/**
 * Docusaurus sites mainly need a stable build-time runtime for chrome strings
 * and generated pages, so this adapter intentionally stays thin.
 */
export function createLingvaDocusaurusRuntime<Resources extends LingvaResources = LingvaResources>(
  input: LingvaRuntimeConfig<Resources> | LingvaRuntimeSetup<Resources>
): LingvaJsRuntime<Resources> {
  return createLingvaJsRuntime(input);
}
