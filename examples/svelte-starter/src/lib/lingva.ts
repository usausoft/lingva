import { createLingvaSvelte } from '@lingva/svelte';
import lingvaConfig from '../../lingva.config';
import lingvaProject, { type resources } from '../../.lingva/generated/project';

/** One client-side store bundle for the Svelte application. */
export const appLingva = createLingvaSvelte<typeof resources>({ ...lingvaConfig, project: lingvaProject });
