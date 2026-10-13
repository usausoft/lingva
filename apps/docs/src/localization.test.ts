import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import sidebars from '../sidebars';

const sourceRoot = new URL('../docs/', import.meta.url);
const translatedRoot = new URL('../i18n/ru/docusaurus-plugin-content-docs/current/', import.meta.url);

function markdownFiles(directory: URL, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(prefix, entry.name);
      if (entry.isDirectory()) {
        return markdownFiles(new URL(`${entry.name}/`, directory), path);
      }
      return entry.name.endsWith('.md') ? [path] : [];
    })
    .sort();
}

function codeExamples(markdown: string): string[] {
  return markdown.match(/^```[^\n]*\n[\s\S]*?^```/gm) ?? [];
}

function headings(markdown: string): string[] {
  return markdown
    .replace(/^```[^\n]*\n[\s\S]*?^```/gm, '')
    .split('\n')
    .filter((line) => /^#{1,6} /u.test(line));
}

test('every public article has a complete Russian counterpart with stable examples and anchors', () => {
  const files = markdownFiles(sourceRoot);
  assert.deepEqual(markdownFiles(translatedRoot), files);
  for (const file of files) {
    const english = readFileSync(new URL(file, sourceRoot), 'utf8');
    const russian = readFileSync(new URL(file, translatedRoot), 'utf8');
    assert.equal(
      russian.match(/^---\n[\s\S]*?\n---/u)?.[0],
      english.match(/^---\n[\s\S]*?\n---/u)?.[0],
      `${file}: route metadata changed`
    );
    const links = (markdown: string) => [...markdown.matchAll(/\]\(([^)]+)\)/gu)].map((match) => match[1]).sort();
    assert.deepEqual(links(russian), links(english), `${file}: link destinations changed`);
    assert.deepEqual(codeExamples(russian), codeExamples(english), `${file}: examples changed during translation`);
    const englishHeadings = headings(english);
    const russianHeadings = headings(russian);
    assert.equal(russianHeadings.length, englishHeadings.length, `${file}: missing sections`);
    assert.match(russian.replace(/^```[^\n]*\n[\s\S]*?^```/gm, ''), /[А-Яа-яЁё]/u, `${file}: English fallback`);
    for (let index = 0; index < englishHeadings.length; index++) {
      assert.equal(
        englishHeadings[index]?.match(/^#+/u)?.[0],
        russianHeadings[index]?.match(/^#+/u)?.[0],
        `${file}: heading hierarchy changed`
      );
      if (englishHeadings[index]?.startsWith('# ')) continue;
      const original = englishHeadings[index]?.match(/\{#([^}]+)\}$/u)?.[1];
      const translated = russianHeadings[index]?.match(/\{#([^}]+)\}$/u)?.[1];
      assert.ok(original, `${file}: source heading needs a stable ID`);
      assert.equal(translated, original, `${file}: translated anchor drift`);
    }
  }
});

test('task navigation contains every article exactly once', () => {
  const categories = sidebars.tutorialSidebar;
  assert.ok(Array.isArray(categories));
  const ids = categories.flatMap((category) => {
    assert.equal(typeof category, 'object');
    assert.ok(typeof category === 'object' && category.type === 'category');
    return category.items;
  });
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    [...ids].sort(),
    markdownFiles(sourceRoot)
      .map((file) => file.slice(0, -3))
      .sort()
  );
});
