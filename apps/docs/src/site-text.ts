import { configureLingvaJs, createLingvaJsRuntime } from '../../../packages/js/src/index';
import docsLingvaConfig, { type DocsLingvaLocale } from '../lingva.config';
import docsLingvaProject, { type resources as docsSiteResources } from '../.lingva/generated/project';

configureLingvaJs({
  ...docsLingvaConfig,
  project: docsLingvaProject,
});

export type DocsSiteLocale = DocsLingvaLocale;

export function getDocsSiteText(locale: DocsSiteLocale = 'en') {
  const runtime = createLingvaJsRuntime<typeof docsSiteResources>();

  runtime.setLocale(locale);

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
  };
}
