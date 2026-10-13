import { createLingvaJsRuntime } from '../../../packages/js/src/index';
import docsLingvaConfig, { docsLingvaLocales, type DocsLingvaLocale } from '../lingva.config';
import docsLingvaProject, { type resources as docsSiteResources } from '../.lingva/generated/project';

export type DocsSiteLocale = DocsLingvaLocale;

/** Docusaurus selects the build locale; the explicit setting is only a standalone fallback. */
export function resolveDocsSiteLocale(locale: string = 'en'): DocsSiteLocale {
  if (!docsLingvaLocales.includes(locale as DocsSiteLocale)) {
    throw new Error(`Unsupported documentation locale: ${locale}`);
  }
  return locale as DocsSiteLocale;
}

export function getDocsSiteText(locale: DocsSiteLocale = 'en') {
  const runtime = createLingvaJsRuntime<typeof docsSiteResources>({
    ...docsLingvaConfig,
    project: docsLingvaProject,
    locale,
  });
  try {
    return {
      locale: runtime.getLocale(),
      title: runtime.tSync('site.title'),
      tagline: runtime.tSync('site.tagline'),
      searchPlaceholder: runtime.tSync('site.searchPlaceholder'),
      docsLabel: runtime.tSync('site.nav.docs'),
      dashboardLabel: runtime.tSync('site.nav.dashboard'),
      footerDocsTitle: runtime.tSync('site.footer.docs'),
      footerGettingStarted: runtime.tSync('site.footer.gettingStarted'),
      footerCopyright: runtime.tSync('site.footer.copyright'),
      sections: {
        start: runtime.tSync('site.sections.start'),
        integrations: runtime.tSync('site.sections.integrations'),
        delivery: runtime.tSync('site.sections.delivery'),
        cli: runtime.tSync('site.sections.cli'),
        examples: runtime.tSync('site.sections.examples'),
        workspace: runtime.tSync('site.sections.workspace'),
        product: runtime.tSync('site.sections.product'),
      },
    };
  } finally {
    runtime.destroy();
  }
}
