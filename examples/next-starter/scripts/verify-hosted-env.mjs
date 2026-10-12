import { readFile } from 'node:fs/promises';
import process from 'node:process';

const envFiles = ['.env.local', '.env'];
const parsedEnv = {};

for (const file of envFiles) {
  try {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');

    for (const line of source.split(/\r?\n/u)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');

      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^['"]|['"]$/gu, '');

      parsedEnv[key] = value;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

const getEnv = (key) => process.env[key] ?? parsedEnv[key];
const requiredKeys = ['LINGVA_PROJECT_ID', 'LINGVA_PUBLISH_API_URL', 'LINGVA_AUTH_ISSUER_URL', 'LINGVA_AUTH_CLIENT_ID'];
const missing = requiredKeys.filter((key) => !getEnv(key));

if (missing.length > 0) {
  throw new Error(`Missing hosted Lingva environment values: ${missing.join(', ')}.`);
}

const leakedKeys = Object.keys({ ...parsedEnv, ...process.env }).filter(
  (key) => key.startsWith('NEXT_PUBLIC_') && key.includes('LINGVA') && /TOKEN|KEY|SECRET/u.test(key)
);

if (leakedKeys.length > 0) {
  throw new Error(`Private Lingva values must not use NEXT_PUBLIC_*: ${leakedKeys.join(', ')}.`);
}

const apiKey = getEnv('LINGVA_API_KEY');

if (apiKey && /^lvk_example_/u.test(apiKey)) {
  throw new Error('LINGVA_API_KEY still contains the example placeholder value.');
}

console.log('Lingva hosted env verified for Next.js starter.');
