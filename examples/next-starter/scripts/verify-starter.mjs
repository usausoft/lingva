import { readFile } from 'node:fs/promises';

const requiredFiles = [
  'README.md',
  'app/globals.css',
  'app/layout.tsx',
  'app/page.tsx',
  'lingva.config.ts',
  'next.config.mjs',
  '.lingva/generated/project.ts',
  '.lingva/metadata.json',
  '.lingva/translations/en.json',
  '.lingva/translations/ru.json',
  'src/components/StarterHome.tsx',
  'src/lingva/provider.tsx',
];

for (const file of requiredFiles) {
  await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
}

const readJson = async (file) => JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
const en = await readJson('.lingva/translations/en.json');
const ru = await readJson('.lingva/translations/ru.json');

const flatten = (value, prefix = '') =>
  Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    return child && typeof child === 'object' && !Array.isArray(child) ? flatten(child, path) : [path];
  });

const enKeys = flatten(en).sort();
const ruKeys = flatten(ru).sort();

if (JSON.stringify(enKeys) !== JSON.stringify(ruKeys)) {
  throw new Error('Next starter locales are out of sync.');
}

const provider = await readFile(new URL('../src/lingva/provider.tsx', import.meta.url), 'utf8');

if (!provider.includes('createLingvaNextProvider')) {
  throw new Error('Next starter provider must use createLingvaNextProvider.');
}

console.log(`Lingva Next.js starter verified (${enKeys.length} keys).`);
