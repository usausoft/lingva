import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { LINGVA_TRANSLATION_KEY_MAX_LENGTH, LINGVA_TRANSLATION_KEY_PATTERN_SOURCE } from '@lingva/core';

const repositoryRoot = new URL('../../../', import.meta.url);

async function readRepositoryFile(path: string): Promise<string> {
  return readFile(new URL(path, repositoryRoot), 'utf8');
}

test('CI supplies existing Algolia secrets to jobs that build public docs', async () => {
  const workflow = await readRepositoryFile('.github/workflows/ci.yml');
  for (const job of ['workspace', 'docs']) {
    const section = workflow.split(`\n  ${job}:\n`)[1]?.split(/\n {2}[a-z-]+:\n/u)[0];
    assert.ok(section, `Missing CI job: ${job}`);
    assert.match(section, /ALGOLIA_APP_ID: \$\{\{ secrets\.ALGOLIA_APP_ID \}\}/u);
    assert.match(section, /ALGOLIA_API_KEY: \$\{\{ secrets\.ALGOLIA_API_KEY \}\}/u);
  }
  const reusable = await readRepositoryFile('.github/workflows/ci-workspace.yml');
  assert.match(reusable, /ALGOLIA_APP_ID: \$\{\{ secrets\.ALGOLIA_APP_ID \}\}/u);
  assert.match(reusable, /ALGOLIA_API_KEY: \$\{\{ secrets\.ALGOLIA_API_KEY \}\}/u);
});

test('public hosted setup uses supported push options', async () => {
  const paths = [
    'README.md',
    'apps/docs/docs/installation/hosted-react-starter.md',
    'apps/docs/docs/installation/next-starter.md',
    'apps/docs/docs/installation/nextjs.md',
    'apps/docs/docs/installation/integration-paths.md',
    'apps/docs/docs/migration/from-static-json.md',
    'examples/hosted-react-starter/README.md',
    'examples/hosted-react-starter/package.json',
    'examples/next-starter/README.md',
    'examples/next-starter/package.json',
    'examples/vue-starter/package.json',
  ];
  const contents = await Promise.all(paths.map(readRepositoryFile));

  for (const content of contents) {
    assert.doesNotMatch(content, /--invalidation-api-url/u);
    assert.doesNotMatch(content, /LINGVA_INVALIDATION_API_URL/u);
  }

  assert.match(contents.join('\n'), /lingva push[\s\S]*--api-url/u);
});

test('customer quickstarts install the CLI before invoking it', async () => {
  const paths = [
    'apps/docs/docs/installation/overview.md',
    'apps/docs/docs/installation/react.md',
    'apps/docs/docs/installation/nextjs.md',
    'apps/docs/docs/installation/integration-paths.md',
    'apps/docs/docs/installation/native-bundles.md',
    'packages/angular/README.md',
    'packages/svelte/README.md',
    'packages/vue/README.md',
  ];
  const contents = await Promise.all(paths.map(readRepositoryFile));

  for (const content of contents) {
    assert.match(content, /@lingva\/cli|lingva-installer/u);
  }
});

test('standalone CLI docs describe one Rust engine and current hosted behavior', async () => {
  const [overview, configuration, integrationPaths, crateReadme, npmReadme, pythonReadme] = await Promise.all(
    [
      'apps/docs/docs/installation/overview.md',
      'apps/docs/docs/installation/configuration.md',
      'apps/docs/docs/installation/integration-paths.md',
      'crates/lingva-cli/README.md',
      'packages/cli/README.md',
      'sdks/python/README.md',
    ].map(readRepositoryFile)
  );

  assert.match(overview, /cargo install lingva/u);
  assert.match(configuration, /npm and PyPI are checksum-verifying launchers, not\s+separate implementations/u);
  assert.match(configuration, /duplicate variant IDs/u);
  assert.match(integrationPaths, /`lingva pull` downloads hosted bundles/u);
  assert.doesNotMatch(integrationPaths, /pull` currently reads the configured local source/u);
  assert.match(crateReadme, /Migrated customer commands never fall back/u);
  assert.match(npmReadme, /push --invalidate/u);
  assert.match(pythonReadme, /never falls back to Python command logic/u);
});

test('Python guide documents the published package and hosted setup contract', async () => {
  const [pythonGuide, pythonReadme, nativeGuide, sdkOverview, releaseGuide, pyproject, publishWorkflow] =
    await Promise.all(
      [
        'apps/docs/docs/installation/python.md',
        'sdks/python/README.md',
        'apps/docs/docs/installation/native-bundles.md',
        'sdks/README.md',
        'sdks/RELEASING.md',
        'sdks/python/pyproject.toml',
        '.github/workflows/publish-python-sdk.yml',
      ].map(readRepositoryFile)
    );

  assert.match(pythonGuide, /python -m pip install "lingva-sdk\[http\]"/u);
  assert.match(pythonGuide, /lingva init[\s\S]*lingva check[\s\S]*lingva push/u);
  assert.match(pythonGuide, /Consumer application setup[\s\S]*LINGVA_API_KEY/u);
  assert.match(pythonGuide, /fully local delivery[\s\S]*LingvaClient\.from_config/u);
  assert.match(pythonGuide, /first launch,[\s\S]*requires network access/u);
  assert.match(pythonGuide, /No Lingva\s+account[\s\S]*prewarmed[\s\S]*no network access/u);
  assert.match(pythonReadme, /Install from PyPI[\s\S]*python -m pip install lingva-sdk/u);
  assert.match(pythonReadme, /LingvaClient\.from_config/u);
  assert.doesNotMatch(pythonReadme, /Once published/u);
  assert.doesNotMatch(nativeGuide, /Swift, Kotlin, Flutter, and Python/u);
  assert.match(nativeGuide, /Python guide/u);
  assert.match(sdkOverview, /PyPI package `lingva-sdk`/u);
  assert.match(releaseGuide, /python-sdk\/v<version>/u);
  assert.match(pyproject, /name = "lingva-sdk"/u);
  assert.match(publishWorkflow, /python-sdk\/v\*/u);
});

test('complete customer reference covers native commands and separated adapters', async () => {
  const [reference, native, customer, npmManifestSource, sdkManifest, pythonManifest] = await Promise.all(
    [
      'apps/docs/docs/installation/cli.md',
      'crates/lingva-cli/src/main.rs',
      'crates/lingva-cli/src/customer.rs',
      'packages/cli/package.json',
      'sdks/python/pyproject.toml',
      'sdks/python-cli/pyproject.toml',
    ].map(readRepositoryFile)
  );
  const commands = [
    'auth',
    'init',
    'update',
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
    'import',
    'extract',
  ];
  for (const command of commands) {
    assert.ok(reference.includes(`lingva ${command}`), `Missing usage example for ${command}.`);
    const variant = command[0]!.toUpperCase() + command.slice(1);
    assert.match(native + customer, new RegExp(`\\b${variant}\\b`, 'u'));
  }
  const npm = JSON.parse(npmManifestSource);
  assert.equal(npm.bin.lingva, './dist/native-launcher.mjs');
  assert.deepEqual(Object.keys(npm.bin), ['lingva']);
  assert.doesNotMatch(sdkManifest, /\[project\.scripts\]/u);
  assert.match(pythonManifest, /lingva = "lingva_cli\._launcher:main"/u);
  assert.match(reference, /CLI `0\.1\.4`/u);
  assert.match(reference, /private undo journal/u);
  assert.match(reference, /recovers an interrupted batch/u);
  assert.match(reference, /publish --dry-run/u);
  assert.match(reference, /publish --local-only/u);
  assert.match(reference, /--callee/u);
  assert.match(reference, /dynamicCalls/u);
});

test('hosted login examples use platform-discovered OAuth metadata', async () => {
  const paths = [
    'apps/docs/docs/installation/hosted-react-starter.md',
    'apps/docs/docs/installation/next-starter.md',
    'apps/docs/docs/installation/nextjs.md',
    'apps/docs/docs/installation/integration-paths.md',
    'apps/docs/docs/migration/from-static-json.md',
    'examples/hosted-react-starter/README.md',
    'examples/next-starter/README.md',
  ];
  const contents = await Promise.all(paths.map(readRepositoryFile));

  for (const content of contents) {
    assert.match(content, /lingva auth login/u);
    assert.doesNotMatch(content, /--issuer-url|--client-id/u);
  }

  assert.match(contents.join('\n'), /--platform-url https:\/\/stage\.lingva\.dev/u);
});

test('customer configuration documents login without operator deployment commands', async () => {
  const configuration = await readRepositoryFile('apps/docs/docs/installation/configuration.md');
  assert.match(configuration, /lingva auth login\n/u);
  assert.match(configuration, /workspace administrator/u);
  assert.doesNotMatch(configuration, /CloudFormation|COGNITO_|auth:env:/u);
});

test('public docs and Python enforce the shared translation-key contract', async () => {
  const [configuration, pythonGuide, pythonLocal] = await Promise.all(
    [
      'apps/docs/docs/installation/configuration.md',
      'apps/docs/docs/installation/python.md',
      'sdks/python/src/lingva/_local.py',
    ].map(readRepositoryFile)
  );

  assert.match(configuration, new RegExp(`at most ${LINGVA_TRANSLATION_KEY_MAX_LENGTH} characters`, 'u'));
  assert.match(configuration, /Pricing\s+and plan quotas count distinct flattened keys/u);
  assert.match(pythonGuide, /shared 200-character portable\s+key contract/u);
  assert.match(pythonLocal, new RegExp(`TRANSLATION_KEY_MAX_LENGTH = ${LINGVA_TRANSLATION_KEY_MAX_LENGTH}`, 'u'));
  assert.ok(pythonLocal.includes(`TRANSLATION_KEY_PATTERN = re.compile(r"${LINGVA_TRANSLATION_KEY_PATTERN_SOURCE}")`));
});

test('starter plans use local artifact commands, never hosted publish or push', async () => {
  const manifest = JSON.parse(await readRepositoryFile('examples/next-starter/package.json'));
  const plan = manifest.scripts['lingva:plan'] as string;
  assert.match(plan, /lingva manifest/u);
  assert.match(plan, /lingva bundle --locale en/u);
  assert.match(plan, /lingva bundle --locale ru/u);
  assert.doesNotMatch(plan, /lingva (?:push|publish)\b/u);
});

test('active scaffold and transfer guides do not retain known contradictory claims', async () => {
  const paths = [
    'README.md',
    'apps/docs/docs/installation/configuration.md',
    'apps/docs/docs/installation/integration-paths.md',
    'apps/docs/docs/installation/nextjs.md',
    'apps/docs/docs/installation/react.md',
    'apps/docs/docs/migration/from-static-json.md',
  ];
  for (const path of paths) {
    const text = await readRepositoryFile(path);
    assert.doesNotMatch(text, /does not download hosted state|pull` command is for file-backed local projects/u);
    assert.doesNotMatch(text, /That creates `lingva\.config\.ts`|Scaffold `lingva\.config\.ts`/u);
    assert.doesNotMatch(text, /types` \(re\)generates `\.lingva\/generated\/project\.ts`/u);
  }
  const configuration = await readRepositoryFile('apps/docs/docs/installation/configuration.md');
  assert.match(configuration, /normalized export embeds resources/u);
  assert.match(configuration, /omits endpoints, credentials, and policies/u);
});

test('public documentation covers server adapters, workspace permissions, and preview limitations', async () => {
  const [adapters, workspace, sdkScope] = await Promise.all(
    ['apps/docs/docs/installation/server-and-site-adapters.md', 'apps/docs/docs/workspace.md', 'sdks/README.md'].map(
      readRepositoryFile
    )
  );
  for (const factory of ['createLingvaNodeRuntime', 'createLingvaElectronRuntime', 'createLingvaDocusaurusRuntime']) {
    assert.ok(adapters.includes(factory), `Missing public example for ${factory}`);
  }
  assert.match(workspace, /mode: plan/u);
  assert.match(workspace, /Do not use that path as a dry run/u);
  assert.match(workspace, /Enable email invites/u);
  assert.match(sdkScope, /does not establish complete cross-language parity/u);
});
