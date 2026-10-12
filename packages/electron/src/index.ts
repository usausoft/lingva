import { createLingvaJsRuntime, type LingvaJsRuntime } from '@lingva/js';
import type { LingvaResources, LingvaRuntimeConfig, LingvaRuntimeSetup } from '@lingva/core';

export { createLingvaJsRuntime } from '@lingva/js';
export type * from '@lingva/js';

/**
 * Electron can reuse the shared JS runtime on both preload and renderer sides
 * while we design a richer desktop-specific storage and sync story.
 */
export function createLingvaElectronRuntime<Resources extends LingvaResources = LingvaResources>(
  input: LingvaRuntimeConfig<Resources> | LingvaRuntimeSetup<Resources>
): LingvaJsRuntime<Resources> {
  return createLingvaJsRuntime(input);
}
