import { readFile } from 'node:fs/promises';

const requiredFiles = [
  'lingva.config.ts',
  '.lingva/generated/project.ts',
  '.lingva/translations/en.json',
  '.lingva/translations/ru.json',
  'src/lib/lingva.ts',
  'src/App.svelte',
];

await Promise.all(requiredFiles.map((file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8')));
console.log('Lingva Svelte starter verified.');
