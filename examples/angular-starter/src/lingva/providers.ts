import { provideLingvaAngular } from '@lingva/angular';
import lingvaConfig from '../../lingva.config';
import lingvaProject from '../../.lingva/generated/project';

/** Keeps Lingva configuration at the Angular application boundary. */
export function provideAppLingva() {
  return provideLingvaAngular({ ...lingvaConfig, project: lingvaProject });
}
