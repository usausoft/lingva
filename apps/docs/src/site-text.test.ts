import assert from 'node:assert/strict';
import test from 'node:test';
import { getDocsSiteText } from './site-text';

test('getDocsSiteText returns localized site chrome', () => {
  const english = getDocsSiteText('en');
  const russian = getDocsSiteText('ru');

  assert.equal(english.title, 'Lingva Documentation');
  assert.equal(russian.title, 'Документация Lingva');
  assert.equal(russian.docsLabel, 'Документы');
});
