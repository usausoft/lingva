import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import { getDocsSiteText, resolveDocsSiteLocale } from './src/site-text';

const docsSiteUrl = process.env.DOCS_SITE_URL ?? 'https://docs.lingva.dev';
const docsBaseUrl = process.env.DOCS_BASE_URL ?? '/';
const dashboardUrl = process.env.DASHBOARD_URL ?? 'https://lingva.dev';
const docsRuntimeLocale = resolveDocsSiteLocale(
  process.env.DOCUSAURUS_CURRENT_LOCALE ?? process.env.DOCS_RUNTIME_LOCALE
);
const siteText = getDocsSiteText(docsRuntimeLocale);

const config: Config = {
  title: siteText.title,
  tagline: siteText.tagline,
  favicon: 'img/favicon.ico',

  url: docsSiteUrl,
  baseUrl: docsBaseUrl,
  organizationName: 'usausoft',
  projectName: 'lingva',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ru'],
    localeConfigs: { en: { label: 'English' }, ru: { label: 'Русский' } },
  },

  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editLocalizedFiles: true,
          editUrl: 'https://github.com/usausoft/lingva/edit/main/apps/docs/',
          routeBasePath: '/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
        blog: false,
      } satisfies Preset.Options,
    ],
  ],

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  themes: ['@docusaurus/theme-mermaid'],

  themeConfig: {
    ...(process.env.ALGOLIA_APP_ID && process.env.ALGOLIA_API_KEY
      ? {
          algolia: {
            appId: process.env.ALGOLIA_APP_ID,
            apiKey: process.env.ALGOLIA_API_KEY,
            indexName: 'Lingva Public Docs',
          },
        }
      : {}),
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: 'Lingva',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: siteText.docsLabel,
        },
        {
          href: dashboardUrl,
          label: siteText.dashboardLabel,
          position: 'right',
        },
        { type: 'localeDropdown', position: 'right' },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: siteText.footerDocsTitle,
          items: [
            {
              label: siteText.footerGettingStarted,
              to: '/',
            },
          ],
        },
      ],
      copyright: siteText.footerCopyright,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
