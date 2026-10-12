import { provideLingvaAngular } from '@lingva/angular';
import lingvaConfig from {{CONFIG_IMPORT}};
{{PROJECT_IMPORT_LINE}}

/** Registers the generated Lingva configuration at the Angular application boundary. */
export function provideAppLingva() {
  return provideLingvaAngular({{ADAPTER_INPUT}});
}
