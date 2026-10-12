import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { prepareNativeArguments } from './native-config';

const configuration = {
  projectId: 'demo',
  environment: 'stage',
  locales: ['en', 'ru'],
  defaultLocale: 'en',
  fallbackLocale: 'en',
  metadataFile: './metadata.json',
  keyMetadata: { title: { description: 'Greeting', reviewer: 'alice', status: 'approved' } },
  resources: { en: { title: 'Hello' }, ru: { title: 'Привет' } },
  cli: { validate: { failOn: 'warning' }, publish: { apiUrl: 'https://api.example.test' } },
};

async function withConfig(run: (root: string, config: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lingva-native-config-'));
  const config = path.join(root, 'lingva.config.mjs');
  try {
    await writeFile(config, `export default ${JSON.stringify(configuration)};\n`);
    await run(root, config);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('JS configuration becomes private same-directory JSON retaining resources and policies', async () => {
  await withConfig(async (root, config) => {
    const prepared = await prepareNativeArguments(['manifest', config, '--format', 'json']);
    try {
      assert.equal(prepared.args[0], 'manifest');
      assert.equal(path.dirname(prepared.args[1]!), root);
      assert.match(path.basename(prepared.args[1]!), /^\.lingva-native-.*\.json$/u);
      const document = JSON.parse(await readFile(prepared.args[1]!, 'utf8'));
      assert.deepEqual(document, configuration);
      assert.deepEqual(prepared.args.slice(2), ['--format', 'json']);
    } finally {
      await prepared.cleanup();
      await prepared.cleanup();
    }
    assert.deepEqual(await readdir(root), ['lingva.config.mjs']);
  });
});

test('file-backed executable configuration does not freeze imported generated resources', async () => {
  await withConfig(async (root, config) => {
    await writeFile(
      config,
      `export default ${JSON.stringify({ ...configuration, translationFiles: './translations/{locale}.json' })};\n`
    );
    const prepared = await prepareNativeArguments(['sync', config]);
    try {
      const document = JSON.parse(await readFile(prepared.args[1]!, 'utf8'));
      assert.equal(document.translationFiles, './translations/{locale}.json');
      assert.equal(document.metadataFile, './metadata.json');
      assert.equal(document.resources, undefined);
      assert.deepEqual(document.cli, configuration.cli);
    } finally {
      await prepared.cleanup();
    }
    assert.deepEqual(await readdir(root), ['lingva.config.mjs']);
  });
});

test('portable arguments and command help never evaluate executable configuration', async () => {
  await withConfig(async (root, config) => {
    await writeFile(config, 'throw new Error("config evaluated unexpectedly");\n');
    const portable = path.join(root, 'lingva.config.yaml');
    await writeFile(portable, 'projectId: demo\n');
    for (const args of [
      ['manifest', portable],
      ['manifest', config, '--help'],
      ['extract', root, '--project', config, '-h'],
      ['validate', config, '--config', config, '--help'],
    ]) {
      const prepared = await prepareNativeArguments(args);
      assert.deepEqual(prepared.args, args);
      await prepared.cleanup();
    }
    assert.deepEqual((await readdir(root)).sort(), ['lingva.config.mjs', 'lingva.config.yaml']);
  });
});

test('--project and --config bridges are independent and clean up every temporary document', async () => {
  await withConfig(async (root, config) => {
    const prepared = await prepareNativeArguments([
      'extract',
      root,
      '--project',
      config,
      '--config',
      config,
      '--policy',
      'ci',
    ]);
    try {
      const project = prepared.args[3]!;
      const policy = prepared.args[5]!;
      assert.notEqual(project, policy);
      assert.equal(path.dirname(project), root);
      assert.equal(path.dirname(policy), root);
      assert.deepEqual(JSON.parse(await readFile(project, 'utf8')), configuration);
      assert.deepEqual(JSON.parse(await readFile(policy, 'utf8')), configuration);
    } finally {
      await prepared.cleanup();
    }
    assert.deepEqual(await readdir(root), ['lingva.config.mjs']);
  });
});

test('conversion failure removes documents created earlier in the same invocation', async () => {
  await withConfig(async (root, config) => {
    const bad = path.join(root, 'bad.mjs');
    await writeFile(bad, 'throw new Error("invalid configuration");\n');
    await assert.rejects(
      prepareNativeArguments(['extract', root, '--project', config, '--config', bad]),
      /invalid configuration/u
    );
    assert.deepEqual((await readdir(root)).sort(), ['bad.mjs', 'lingva.config.mjs']);
  });
});

test('lightweight executable policy settings need no project identity', async () => {
  await withConfig(async (root, config) => {
    const settings = { cli: { validatePolicies: { ci: { failOn: 'error' } }, extract: { failOn: 'missing' } } };
    await writeFile(config, `export default ${JSON.stringify(settings)};\n`);
    const prepared = await prepareNativeArguments(['extract', root, '--config', config, '--policy', 'ci']);
    try {
      const document = JSON.parse(await readFile(prepared.args[3]!, 'utf8'));
      assert.deepEqual(document.cli, settings.cli);
      assert.equal(document.projectId, undefined);
      assert.equal(document.resources, undefined);
    } finally {
      await prepared.cleanup();
    }
    assert.deepEqual(await readdir(root), ['lingva.config.mjs']);
  });
});

test('directory validation selects only temporary documents owned by its invocation', async () => {
  await withConfig(async (root, config) => {
    await writeFile(
      path.join(root, 'other.config.mjs'),
      `export default ${JSON.stringify({ ...configuration, projectId: 'other' })};\n`
    );
    const unrelated = '.lingva-native-unrelated-0.json';
    await writeFile(path.join(root, unrelated), '{}\n');
    const first = await prepareNativeArguments(['validate', root, '--glob', '*.config.mjs']);
    const second = await prepareNativeArguments(['validate', root, '--glob', '*.config.mjs']);
    const firstGlob = first.args[first.args.indexOf('--glob') + 1]!;
    const secondGlob = second.args[second.args.indexOf('--glob') + 1]!;
    try {
      assert.notEqual(firstGlob, secondGlob);
      assert.match(firstGlob, /^\.lingva-native-[a-f\d-]+-\*\.json$/u);
      const files = await readdir(root);
      assert.equal(files.filter((file) => file.startsWith(firstGlob.split('*')[0]!)).length, 2);
      assert.equal(files.filter((file) => file.startsWith(secondGlob.split('*')[0]!)).length, 2);
      assert.ok(!unrelated.startsWith(firstGlob.split('*')[0]!));
      await first.cleanup();
      assert.equal((await readdir(root)).filter((file) => file.startsWith(secondGlob.split('*')[0]!)).length, 2);
    } finally {
      await first.cleanup();
      await second.cleanup();
    }
    assert.deepEqual((await readdir(root)).sort(), [unrelated, path.basename(config), 'other.config.mjs'].sort());
  });
});

test('positional executable configs after valued or equals options are converted correctly', async () => {
  await withConfig(async (root, config) => {
    for (const prefix of [
      ['bundle', '--locale', 'en'],
      ['bundle', '--locale=en'],
    ]) {
      const args = [...prefix, config, '--format=json'];
      const prepared = await prepareNativeArguments(args);
      try {
        assert.deepEqual(prepared.args.slice(0, prefix.length), prefix);
        const converted = prepared.args[prefix.length]!;
        assert.equal(path.dirname(converted), root);
        assert.deepEqual(JSON.parse(await readFile(converted, 'utf8')), configuration);
        assert.equal(prepared.args.at(-1), '--format=json');
      } finally {
        await prepared.cleanup();
      }
    }
    assert.deepEqual(await readdir(root), ['lingva.config.mjs']);
  });
});

test('equals syntax project config and directory glob options retain their option shape', async () => {
  await withConfig(async (root, config) => {
    const prepared = await prepareNativeArguments(['extract', root, `--project=${config}`, `--config=${config}`]);
    try {
      for (const [index, prefix] of [
        [2, '--project='],
        [3, '--config='],
      ] as const) {
        assert.ok(prepared.args[index]!.startsWith(prefix));
        const converted = prepared.args[index]!.slice(prefix.length);
        assert.deepEqual(JSON.parse(await readFile(converted, 'utf8')), configuration);
      }
    } finally {
      await prepared.cleanup();
    }
    const directory = await prepareNativeArguments(['validate', root, '--glob=*.config.mjs']);
    try {
      assert.match(directory.args[2]!, /^--glob=\.lingva-native-[a-f\d-]+-\*\.json$/u);
      assert.equal((await readdir(root)).filter((file) => file.startsWith('.lingva-native-')).length, 1);
    } finally {
      await directory.cleanup();
    }
    assert.deepEqual(await readdir(root), ['lingva.config.mjs']);
  });
});

test('inline executable resource mutations reject rather than silently modify disposable snapshots', async () => {
  await withConfig(async (root, config) => {
    const original = await readFile(config, 'utf8');
    for (const command of ['sync', 'apply', 'approve', 'pull']) {
      await assert.rejects(prepareNativeArguments([command, config]), /Inline JS\/TS resources cannot be edited/u);
      assert.equal(await readFile(config, 'utf8'), original);
      assert.deepEqual(await readdir(root), ['lingva.config.mjs']);
    }
  });
});

test('read-only inline resource previews remain supported and clean up without modifying source', async () => {
  await withConfig(async (root, config) => {
    const original = await readFile(config, 'utf8');
    for (const args of [
      ['sync', config, '--dry-run'],
      ['sync', config, '--check'],
      ['check', config],
      ['approve', config, '--draft=draft.json', '--dry-run'],
      ['pull', config, '--output', 'downloads/{locale}.json'],
      ['pull', config, '--output=downloads/{locale}.json'],
    ]) {
      const prepared = await prepareNativeArguments(args);
      try {
        assert.notEqual(prepared.args[1], config);
        assert.deepEqual(JSON.parse(await readFile(prepared.args[1]!, 'utf8')), configuration);
      } finally {
        await prepared.cleanup();
      }
      assert.equal(await readFile(config, 'utf8'), original);
      assert.deepEqual(await readdir(root), ['lingva.config.mjs']);
    }
  });
});

test('init config target is an output path and must never be evaluated', async () => {
  await withConfig(async (root, config) => {
    await writeFile(config, 'throw new Error("init evaluated its output target");\n');
    for (const args of [
      ['init', '--config', config],
      ['init', `--config=${config}`],
    ]) {
      const prepared = await prepareNativeArguments(args);
      assert.deepEqual(prepared.args, args);
      await prepared.cleanup();
    }
    assert.deepEqual(await readdir(root), ['lingva.config.mjs']);
  });
});
