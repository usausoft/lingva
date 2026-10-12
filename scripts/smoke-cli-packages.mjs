/** Fresh-package proof: real archived engine, npm postinstall, independent wheel. */
/* eslint-disable turbo/no-undeclared-env-vars -- Native release smoke runs directly, outside Turbo. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const archive = path.resolve(process.argv[2] ?? '');
assert.ok(process.argv[2], "Pass the archive containing this platform's real compiled engine.");
const manifest = JSON.parse(await fs.readFile(path.join(root, 'packages/cli/package.json'), 'utf8'));
const ENV_FLAG_ENABLED = '1';
const publicCore = process.env.LINGVA_SMOKE_PUBLIC_CORE === ENV_FLAG_ENABLED;
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-cli-packages-'));
const packageManager = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const python = process.env.LINGVA_TEST_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
const environment = { ...process.env };
for (const name of [
  'LINGVA_CLI_BINARY',
  'LINGVA_CLI_VERSION',
  'LINGVA_CLI_NATIVE_REQUIRED',
  'LINGVA_CLI_ASSET_BASE_URL',
]) {
  delete environment[name];
}

async function run(command, args, options = {}) {
  let output = '';
  const result = await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      env: options.env ?? environment,
      shell: process.platform === 'win32' && command.endsWith('.cmd'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.once('error', reject);
    // Windows command shims may exit before descendant handles close. Wait for
    // the streams too, so the next step and cleanup cannot race those handles.
    child.once('close', (code) => {
      resolve(code);
    });
  });
  assert.equal(result, 0, `${command} ${args.join(' ')} failed:\n${output}`);
  return output;
}

let server;
try {
  const tarballs = path.join(temporary, 'tarballs');
  const consumer = path.join(temporary, 'consumer');
  const packageRoot = path.join(temporary, 'package');
  await fs.mkdir(tarballs);
  await fs.mkdir(consumer);
  await run(packageManager, ['--filter', '@lingva/cli', 'pack', '--pack-destination', tarballs]);
  await run(packageManager, ['--filter', '@lingva/core', 'pack', '--pack-destination', tarballs]);
  const names = await fs.readdir(tarballs);
  const cliTarball = path.join(
    tarballs,
    names.find((name) => name.startsWith('lingva-cli-'))
  );
  const coreTarball = path.join(
    tarballs,
    names.find((name) => name.startsWith('lingva-core-'))
  );
  // Repack with a real target asset in an isolated package, never mutate source assets.
  await run('tar', ['-xzf', cliTarball, '-C', temporary]);
  const bytes = await fs.readFile(archive);
  const asset = path.basename(archive);
  const checksum = `${createHash('sha256').update(bytes).digest('hex')}  ${asset}\n`;
  await fs.mkdir(path.join(packageRoot, 'assets'), { recursive: true });
  await fs.copyFile(archive, path.join(packageRoot, 'assets', asset));
  await fs.writeFile(path.join(packageRoot, 'assets/SHA256SUMS'), checksum);
  await run(packageManager, ['--dir', packageRoot, 'pack', '--pack-destination', tarballs]);
  await fs.writeFile(
    path.join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      dependencies: {
        '@lingva/cli': `file:${cliTarball}`,
        ...(publicCore ? {} : { '@lingva/core': `file:${coreTarball}` }),
      },
    })
  );
  await fs.writeFile(
    path.join(consumer, 'pnpm-workspace.yaml'),
    publicCore
      ? 'packages: []\n'
      : `packages: []\noverrides:\n  '@lingva/core': ${JSON.stringify(`file:${coreTarball}`)}\n`
  );
  // Release acceptance must refresh registry metadata: a cached pre-release
  // packument can otherwise hide the SDK version published immediately before.
  await run(packageManager, ['install', '--no-prefer-offline', '--ignore-scripts'], { cwd: consumer });
  const installed = path.join(consumer, 'node_modules/@lingva/cli');
  assert.deepEqual(await fs.readFile(path.join(installed, 'assets', asset)), bytes);
  await run(process.execPath, [path.join(installed, 'install-native.mjs')], { cwd: consumer });
  const npmLauncher = path.join(installed, 'dist/native-launcher.mjs');
  assert.match(
    await run(process.execPath, [npmLauncher, '--version'], { cwd: consumer }),
    new RegExp(`lingva ${manifest.version.replaceAll('.', '\\.')}`)
  );
  await run(
    process.execPath,
    [
      npmLauncher,
      'init',
      '--mode',
      'local',
      '--no-auth',
      '--sdk',
      'python',
      '--project-id',
      'package-smoke',
      '--locale',
      'en,ru',
    ],
    { cwd: consumer }
  );
  await run(process.execPath, [npmLauncher, 'check'], { cwd: consumer });
  const npmBundle = JSON.parse(
    await run(process.execPath, [npmLauncher, 'bundle', '--locale', 'en', '--format', 'json'], { cwd: consumer })
  );
  await fs.writeFile(
    path.join(consumer, 'bridge.config.mjs'),
    'export default { projectId: "package-smoke", locales: ["en", "ru"], defaultLocale: "en", fallbackLocale: "en", translationFiles: ".lingva/translations/{locale}.json" };\n'
  );
  const bridgeBundle = JSON.parse(
    await run(process.execPath, [npmLauncher, 'bundle', 'bridge.config.mjs', '--locale', 'en', '--format', 'json'], {
      cwd: consumer,
    })
  );
  delete bridgeBundle.generatedAt;
  const stableNpmBundle = { ...npmBundle };
  delete stableNpmBundle.generatedAt;
  assert.deepEqual(bridgeBundle, stableNpmBundle, 'Packed JS config bridge must preserve the portable bundle.');
  assert.ok(
    !(await fs.readdir(consumer)).some((name) => name.startsWith('.lingva-native-')),
    'Bridge temporary config must be cleaned up.'
  );

  const wheels = path.join(temporary, 'wheels');
  await run(python, ['-m', 'build', '--no-isolation', '--wheel', '--outdir', wheels, 'sdks/python-cli']);
  const venv = path.join(temporary, 'venv');
  await run(python, ['-m', 'venv', venv]);
  const venvPython = path.join(venv, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const pythonLauncher = path.join(venv, process.platform === 'win32' ? 'Scripts/lingva.exe' : 'bin/lingva');
  const wheel = (await fs.readdir(wheels)).find((name) => name.endsWith('.whl'));
  await run(venvPython, ['-m', 'pip', 'install', '--no-deps', path.join(wheels, wheel)]);
  // A local mirror exercises download/checksum/cache behavior without publishing
  // unreleased assets. No binary override is permitted in this acceptance check.
  server = http.createServer((request, response) => {
    if (request.url === `/${asset}`) {
      response.end(bytes);
    } else if (request.url === '/SHA256SUMS') {
      response.end(checksum);
    } else {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const cliEnvironment = {
    ...environment,
    LINGVA_CLI_CACHE_DIR: path.join(temporary, 'cache'),
    LINGVA_CLI_ASSET_BASE_URL: `http://127.0.0.1:${server.address().port}`,
  };
  assert.match(
    await run(pythonLauncher, ['--version'], { cwd: consumer, env: cliEnvironment }),
    new RegExp(`lingva ${manifest.version.replaceAll('.', '\\.')}`)
  );
  await new Promise((resolve) => server.close(resolve));
  server = undefined;
  const pythonBundle = JSON.parse(
    await run(pythonLauncher, ['bundle', '--locale', 'en', '--format', 'json'], { cwd: consumer, env: cliEnvironment })
  );
  delete npmBundle.generatedAt;
  delete pythonBundle.generatedAt;
  assert.deepEqual(pythonBundle, npmBundle, 'Fresh adapters must produce identical Rust bundle contracts.');
  await run(venvPython, ['-c', 'import importlib.util; assert importlib.util.find_spec("lingva") is None'], {
    env: { ...environment, PYTHONPATH: '' },
  });
  await run(python, ['-m', 'build', '--no-isolation', '--wheel', '--outdir', wheels, 'sdks/python']);
  const sdkWheel = (await fs.readdir(wheels)).find((name) => name.startsWith('lingva_sdk-') && name.endsWith('.whl'));
  await run(venvPython, ['-m', 'pip', 'install', path.join(wheels, sdkWheel)]);
  await run(
    venvPython,
    [
      '-c',
      'import importlib.metadata as m; from lingva import LingvaClient; assert not any(e.name == "lingva" for e in m.distribution("lingva-sdk").entry_points); assert LingvaClient.from_config(locale="en").t("missing") == "missing"',
    ],
    { cwd: consumer, env: { ...environment, PYTHONPATH: '' } }
  );
  await run(pythonLauncher, ['--version'], { cwd: consumer, env: cliEnvironment });
  // Every adapter exposes the exact engine command/option contract. Functional
  // JSON parity catches wrapper argument rewrites beyond a version-only smoke.
  for (const command of [
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
  ]) {
    const npmHelp = await run(process.execPath, [npmLauncher, command, '--help'], { cwd: consumer });
    const pythonHelp = await run(pythonLauncher, [command, '--help'], { cwd: consumer, env: cliEnvironment });
    assert.equal(pythonHelp, npmHelp, `${command} options must match across adapters.`);
  }
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => key !== 'generatedAt')
          .map(([key, item]) => [key, stable(item)])
      );
    }
    return value;
  }
  for (const args of [
    ['manifest'],
    ['bundle', '--locale', 'en'],
    ['export'],
    ['workflow'],
    ['validate'],
    ['check'],
    ['publish', '--dry-run'],
  ]) {
    const options = [...args, '--format', 'json'];
    const npmResult = JSON.parse(await run(process.execPath, [npmLauncher, ...options], { cwd: consumer }));
    const pythonResult = JSON.parse(await run(pythonLauncher, options, { cwd: consumer, env: cliEnvironment }));
    assert.deepEqual(stable(pythonResult), stable(npmResult), `${args[0]} must have identical engine semantics.`);
  }
  for (const command of ['types', 'helpers']) {
    const npmResult = await run(process.execPath, [npmLauncher, command], { cwd: consumer });
    const pythonResult = await run(pythonLauncher, [command], { cwd: consumer, env: cliEnvironment });
    assert.equal(pythonResult, npmResult, `${command} generated source must match across adapters.`);
  }
  console.log(`Fresh npm package and independent Python wheel pass for ${asset}; Python cache works offline.`);
} catch (error) {
  // A cleanup failure must not hide the actual package/engine assertion.
  console.error(error);
  throw error;
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await fs.rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
