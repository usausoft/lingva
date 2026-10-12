import assert from 'node:assert/strict';
import en from '../.lingva/translations/en.json' with { type: 'json' };
import ru from '../.lingva/translations/ru.json' with { type: 'json' };

assert.deepEqual(Object.keys(en.app).sort(), Object.keys(ru.app).sort());
assert.notEqual(en.app.title, ru.app.title);
console.log('Lingva Nuxt SSR starter verified.');
