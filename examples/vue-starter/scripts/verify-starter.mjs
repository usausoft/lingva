import { readFile } from 'node:fs/promises';

const requiredFiles = [
  'lingva.config.ts',
  '.lingva/generated/project.ts',
  '.lingva/translations/en.json',
  '.lingva/translations/ru.json',
  'src/App.vue',
  'src/main.ts',
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
  throw new Error('Starter locales are out of sync.');
}

console.log(`Lingva Vue starter verified (${enKeys.length} keys).`);
