import type { ReactNode } from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import MountainSvg from '@site/static/img/undraw_docusaurus_mountain.svg';
import ReactSvg from '@site/static/img/undraw_docusaurus_react.svg';
import TreeSvg from '@site/static/img/undraw_docusaurus_tree.svg';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: typeof MountainSvg;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Translation contracts as code',
    Svg: MountainSvg,
    description: (
      <>
        Keep locale resources, typed keys, validation, and fallback behavior in the same development workflow as the
        product that consumes them.
      </>
    ),
  },
  {
    title: 'Local or hosted delivery',
    Svg: TreeSvg,
    description: (
      <>
        Start with repository-backed translations, then opt into Lingva Store, draft review, and hosted bundles when the
        team needs remote collaboration.
      </>
    ),
  },
  {
    title: 'Framework-ready runtime',
    Svg: ReactSvg,
    description: (
      <>
        Use the shared core contract through JavaScript, React, Next.js, Angular, Vue, Svelte, Docusaurus, or Electron.
      </>
    ),
  },
];

function Feature({ title, Svg, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props) => (
            <Feature key={props.title} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
