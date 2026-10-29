import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, it } from 'node:test';
import vm from 'node:vm';
import { parseAllDocuments } from 'yaml';

const require = createRequire(import.meta.url);
const packageRoot = path.dirname(require.resolve('deepmerge/package.json'));
const browser = {};
new vm.Script(readFileSync(path.join(packageRoot, 'dist/umd.js'), 'utf8')).runInNewContext(browser);
const entrypoints = [
  ['CJS', require('deepmerge')],
  ['UMD', browser.deepmerge],
];

it('limits the deepmerge advisory exception to the patched version across the entire lockfile graph', () => {
  const graphs = parseAllDocuments(readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8'))
    .map((document) => {
      assert.deepEqual(document.errors, []);
      return document.toJSON();
    })
    .filter((graph) => Object.keys(graph.packages ?? {}).some((name) => name.startsWith('deepmerge@')));
  assert.equal(graphs.length, 1);
  const graph = graphs[0];
  assert.deepEqual(
    Object.keys(graph.packages).filter((name) => name.startsWith('deepmerge@')),
    ['deepmerge@4.3.1']
  );
  const hash = graph.patchedDependencies?.['deepmerge@4.3.1'];
  assert.match(hash ?? '', /^[a-f0-9]{64}$/);
  assert.deepEqual(
    Object.keys(graph.snapshots).filter((name) => name.startsWith('deepmerge@')),
    [`deepmerge@4.3.1(patch_hash=${hash})`]
  );
});

for (const [name, merge] of entrypoints) {
  describe(`installed deepmerge ${name}`, () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      for (const side of ['source', 'target']) {
        it(`rejects poisoned ${key} in the ${side} copy path`, () => {
          const payload = JSON.parse(`{"${key}":{"isAdmin":true}}`);
          const result = side === 'source' ? merge(Object.create(null), payload) : merge(payload, {});
          assert.equal(result.isAdmin, undefined);
          assert.equal(Object.getPrototypeOf(result).isAdmin, undefined);
          assert.equal(Object.hasOwn(result, key), false);
          assert.equal({}.isAdmin, undefined);
        });
      }
    }
    for (const empty of [null, undefined, false]) {
      it(`rejects nested poisoning through a ${String(empty)} placeholder`, () => {
        const result = merge({ session: empty }, { session: JSON.parse('{"__proto__":{"isAdmin":true}}') });
        assert.equal(result.session.isAdmin, undefined);
        assert.equal(Object.getPrototypeOf(result.session).isAdmin, undefined);
        assert.equal(Object.hasOwn(result.session, '__proto__'), false);
      });
    }
    it('preserves normal arrays, nested values and input isolation', () => {
      const target = { list: [1], nested: { before: true } };
      const result = merge(target, { list: [2], nested: { after: true } });
      assert.equal(JSON.stringify(result), '{"list":[1,2],"nested":{"before":true,"after":true}}');
      assert.equal(JSON.stringify(target), '{"list":[1],"nested":{"before":true}}');
      result.nested.before = false;
      assert.equal(target.nested.before, true);
    });
    it('preserves symbols, custom merge callbacks and merge.all', () => {
      const symbol = Symbol('synthetic');
      const result = merge(
        { [symbol]: { left: true }, list: [1] },
        { [symbol]: { right: true }, list: [2] },
        {
          customMerge: (key) => (key === 'list' ? (_target, source) => source : undefined),
        }
      );
      assert.equal(JSON.stringify(result[symbol]), '{"left":true,"right":true}');
      assert.equal(JSON.stringify(result.list), '[2]');
      assert.equal(JSON.stringify(merge.all([{ first: 1 }, { second: 2 }])), '{"first":1,"second":2}');
    });
  });
}
