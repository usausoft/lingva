/** npm-only JS/TS evaluation bridge; all command behavior remains native. */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

const EXECUTABLE_CONFIG = /\.(?:ts|js|mjs|cjs)$/u;
const CONFIG_COMMANDS = new Set([
  'sync',
  'check',
  'pull',
  'push',
  'metadata',
  'apply',
  'approve',
  'studio',
  'drafts',
  'validate',
  'manifest',
  'bundle',
  'publish',
  'invalidate',
  'workflow',
  'types',
  'helpers',
  'export',
]);
const CONFIG_LOOKUP = [
  'lingva.config.yaml',
  'lingva.config.yml',
  'lingva.config.json',
  'lingva.ts',
  'lingva.mjs',
  'lingva.js',
  'lingva.config.ts',
  'lingva.config.js',
  'lingva.config.mjs',
];
const VALUE_OPTIONS = new Set([
  '--format',
  '--output',
  '--output-dir',
  '--locale',
  '--input',
  '--draft',
  '--draft-id',
  '--api-url',
  '--auth-token',
  '--publish-api-url',
  '--publish-auth-token',
  '--environment',
  '--approved-by',
  '--source',
  '--reason',
  '--status',
  '--key',
  '--limit',
  '--callee',
  '--next-token',
  '--fail-on',
  '--only',
  '--ignore',
  '--max-issues',
  '--policy',
  '--glob',
  '--config',
  '--project',
  '--extensions',
  '--exclude',
]);
const INLINE_MUTATIONS = new Set(['sync', 'apply', 'approve', 'pull']);

function positionalIndex(args: string[]): number {
  for (let index = 1; index < args.length; index += 1) {
    const value = args[index]!;
    if (value === '--') {
      return index + 1 < args.length ? index + 1 : -1;
    }
    if (VALUE_OPTIONS.has(value)) {
      index += 1;
    } else if (!value.startsWith('-')) {
      return index;
    }
  }
  return -1;
}

function option(args: string[], flag: string): { value?: string; replace: (value: string) => void } {
  const index = args.findIndex((value) => value === flag || value.startsWith(`${flag}=`));
  const equals = index >= 0 && args[index]!.startsWith(`${flag}=`);
  let selected: string | undefined;
  if (index >= 0) {
    selected = equals ? args[index]!.slice(flag.length + 1) : args[index + 1];
  }
  return {
    value: selected,
    replace: (value) => {
      if (index < 0) {
        args.push(flag, value);
      } else if (equals) {
        args[index] = `${flag}=${value}`;
      } else {
        args[index + 1] = value;
      }
    },
  };
}

export async function prepareNativeArguments(
  input: readonly string[]
): Promise<{ args: string[]; cleanup: () => Promise<void> }> {
  const args = [...input];
  const temporaryFiles: string[] = [];
  const cleanup = async () => {
    await Promise.all(temporaryFiles.map((file) => fs.rm(file, { force: true })));
  };
  // Help must never evaluate configuration or require project filesystem access.
  if (args.includes('--help') || args.includes('-h')) {
    return { args, cleanup };
  }
  const invocation = randomUUID();
  const convert = async (source: string): Promise<string> => {
    const { materializeLingvaPortableConfig } = await import('./index');
    const document = await materializeLingvaPortableConfig(source);
    const readOnly =
      args.includes('--dry-run') ||
      (args[0] === 'sync' && args.includes('--check')) ||
      (args[0] === 'pull' && option(args, '--output').value !== undefined);
    // Executable source cannot safely be rewritten. Mutating a disposable
    // snapshot then deleting it would falsely report a durable update.
    if (document.resources && INLINE_MUTATIONS.has(args[0] ?? '') && !readOnly) {
      throw new Error(
        'Inline JS/TS resources cannot be edited through a temporary config. Use file-backed translationFiles or a portable JSON/YAML resource owner.'
      );
    }
    const temporary = path.join(
      path.dirname(path.resolve(source)),
      `.lingva-native-${invocation}-${temporaryFiles.length}.json`
    );
    temporaryFiles.push(temporary);
    await fs.writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    return temporary;
  };
  try {
    const command = args[0];
    if (command && CONFIG_COMMANDS.has(command)) {
      let sourceIndex = positionalIndex(args);
      let source = sourceIndex >= 0 ? args[sourceIndex] : undefined;
      if (!source) {
        source = CONFIG_LOOKUP.find((candidate) => existsSync(candidate));
        if (source) {
          args.splice(1, 0, source);
          sourceIndex = 1;
        }
      }
      if (source && EXECUTABLE_CONFIG.test(source)) {
        args[sourceIndex] = await convert(source);
      } else if (source && command === 'validate' && (await fs.stat(source)).isDirectory()) {
        const globOption = option(args, '--glob');
        const glob = globOption.value;
        if (!glob || EXECUTABLE_CONFIG.test(glob)) {
          const { resolveLingvaProjectFiles } = await import('./index');
          const files = await resolveLingvaProjectFiles(source, { glob });
          if (files.some((file) => EXECUTABLE_CONFIG.test(file))) {
            for (const file of files) {
              await convert(file);
            }
            const nativeGlob = `.lingva-native-${invocation}-*.json`;
            globOption.replace(nativeGlob);
          }
        }
      }
    }
    for (const flag of args[0] === 'init' ? [] : ['--project', '--config']) {
      const selected = option(args, flag);
      const source = selected.value;
      if (source && EXECUTABLE_CONFIG.test(source)) {
        selected.replace(await convert(source));
      }
    }
    return { args, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
