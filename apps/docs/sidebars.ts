import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';
import { getDocsSiteText, resolveDocsSiteLocale } from './src/site-text';

const { sections } = getDocsSiteText(
  resolveDocsSiteLocale(process.env.DOCUSAURUS_CURRENT_LOCALE ?? process.env.DOCS_RUNTIME_LOCALE)
);

/** Group by reader task while preserving existing document URLs and IDs. */
const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: 'category',
      label: sections.start,
      collapsed: false,
      items: ['intro', 'overview', 'installation/overview', 'installation/integration-paths'],
    },
    {
      type: 'category',
      label: sections.integrations,
      items: [
        'installation/js',
        'installation/react',
        'installation/nextjs',
        'installation/angular',
        'installation/vue',
        'installation/svelte',
        'installation/python',
        'installation/server-and-site-adapters',
        'installation/native-bundles',
      ],
    },
    {
      type: 'category',
      label: sections.delivery,
      items: [
        'installation/configuration',
        'installation/cdn',
        'installation/runtime-contracts',
        'installation/microfrontends',
      ],
    },
    { type: 'category', label: sections.cli, items: ['installation/cli'] },
    {
      type: 'category',
      label: sections.examples,
      items: ['installation/next-starter', 'installation/hosted-react-starter'],
    },
    { type: 'category', label: sections.workspace, items: ['workspace', 'workspace/github', 'migration/from-static-json'] },
    { type: 'category', label: sections.product, items: ['progress', 'roadmap'] },
  ],
};

export default sidebars;
