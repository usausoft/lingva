import assert from 'node:assert/strict';
import test from 'node:test';
import { getDocsSiteText, resolveDocsSiteLocale } from './site-text';

test('getDocsSiteText returns localized site chrome', () => {
  const english = getDocsSiteText('en');
  const russian = getDocsSiteText('ru');

  assert.equal(english.title, 'Lingva Documentation');
  assert.equal(russian.title, 'Документация Lingva');
  assert.equal(russian.docsLabel, 'Документы');
});

test('site chrome isolates locale state and rejects unsupported locales', () => {
  const first = getDocsSiteText('en');
  const russian = getDocsSiteText('ru');
  assert.deepEqual(getDocsSiteText('en'), first);
  assert.equal(first.sections.start, 'Start here');
  assert.equal(russian.sections.start, 'Начало работы');
  assert.equal(resolveDocsSiteLocale(), 'en');
  assert.equal(resolveDocsSiteLocale('ru'), 'ru');
  assert.throws(() => resolveDocsSiteLocale('fr'), /Unsupported documentation locale/);
});
