import { readFile } from 'node:fs/promises';

const requiredFiles = [
  'lingva.config.ts',
  '.lingva/generated/project.ts',
  '.lingva/translations/en.json',
  '.lingva/translations/ru.json',
  'src/lingva/providers.ts',
  'src/app.component.ts',
];

await Promise.all(requiredFiles.map((file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8')));
console.log('Lingva Angular starter verified.');
