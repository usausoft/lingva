import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const CARGO_MANIFEST = new URL('../crates/lingva-cli/Cargo.toml', import.meta.url);
const NPM_MANIFEST = new URL('../packages/cli/package.json', import.meta.url);
const PYTHON_LAUNCHER = new URL('../sdks/python-cli/src/lingva_cli/_launcher.py', import.meta.url);
const PYTHON_MANIFEST = new URL('../sdks/python-cli/pyproject.toml', import.meta.url);

const [cargoManifest, npmManifestSource, pythonLauncher, pythonManifest] = await Promise.all([
  fs.readFile(CARGO_MANIFEST, 'utf8'),
  fs.readFile(NPM_MANIFEST, 'utf8'),
  fs.readFile(PYTHON_LAUNCHER, 'utf8'),
  fs.readFile(PYTHON_MANIFEST, 'utf8'),
]);

const cargoVersion = cargoManifest.match(/^version\s*=\s*"([^"]+)"/mu)?.[1];
const npmManifest = JSON.parse(npmManifestSource);
const npmVersion = npmManifest.lingvaEngineVersion;
const pythonVersion = pythonLauncher.match(/^ENGINE_VERSION\s*=\s*"([^"]+)"/mu)?.[1];

assert.ok(cargoVersion, 'The lingva Cargo package must declare a version.');
assert.equal(npmManifest.version, cargoVersion, '@lingva/cli package and engine versions must match.');
assert.equal(npmVersion, cargoVersion, '@lingva/cli must pin the current Rust engine version.');
assert.equal(pythonVersion, cargoVersion, 'lingva-cli must pin the current Rust engine version.');
assert.equal(
  pythonManifest.match(/^version\s*=\s*"([^"]+)"/mu)?.[1],
  cargoVersion,
  'lingva-cli package and engine versions must match.'
);

console.log(`Lingva CLI adapter versions match Rust engine v${cargoVersion}.`);
