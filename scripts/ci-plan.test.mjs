import assert from 'node:assert/strict';
import test from 'node:test';
import { dependencyClosure, routeChanges } from './ci-plan.mjs';

const packages = [
  { name: '@lingva/core', directory: 'packages/core', dependencies: [] },
  { name: '@lingva/js', directory: 'packages/js', dependencies: ['@lingva/core'] },
  { name: '@lingva/cli', directory: 'packages/cli', dependencies: ['@lingva/core'] },
  { name: '@lingva/docs', directory: 'apps/docs', dependencies: ['@lingva/js'] },
];

test('core changes verify dependent consumers and all native runtimes', () => {
  const { required, workspace } = routeChanges(['packages/core/src/index.ts'], packages);
  assert.deepEqual(workspace, ['@lingva/core', '@lingva/js']);
  for (const group of ['cli', 'docs', 'swift', 'kotlin', 'python', 'flutter']) assert.equal(required[group], true);
});
test('native source changes select only the matching runtime', () => {
  for (const sdk of ['swift', 'kotlin', 'flutter']) {
    const selected = routeChanges([`sdks/${sdk}/src/runtime`], packages).required;
    assert.deepEqual(Object.keys(selected).filter((key) => selected[key]), [sdk]);
  }
});
test('documentation does not start native runtime checks', () => {
  const selected = routeChanges(['apps/docs/docs/intro.md'], packages).required;
  assert.deepEqual(Object.keys(selected).filter((key) => selected[key]), ['docs']);
});
test('unknown code gets conservative verification', () => {
  const selected = routeChanges(['new-runtime/index.ts'], packages).required;
  assert.ok(Object.values(selected).every(Boolean));
});
test('dependencies include the full local build graph', () => {
  assert.deepEqual(dependencyClosure(['@lingva/docs'], packages, 'dependencies'), ['@lingva/core', '@lingva/docs', '@lingva/js']);
});
