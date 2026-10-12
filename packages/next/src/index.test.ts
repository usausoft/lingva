import test from 'node:test';
import assert from 'node:assert/strict';
import { configureLingvaNextClient, createLingvaNextProvider, defineLingvaNextConfig } from './index';
import { defineLingvaProject } from '@lingva/core';

test('defineLingvaNextConfig returns the shared Lingva config shape', () => {
  const config = defineLingvaNextConfig({
    locales: ['en', 'ru'],
    defaultLocale: 'en',
    locale: 'en',
    fallbackLocale: 'en',
    translationFiles: '.lingva/translations/{locale}.json',
    generatedProjectFile: '.lingva/generated/project.ts',
    delivery: {
      mode: 'local',
      path: '.lingva/translations/{locale}.json',
    },
  });

  assert.equal(config.defaultLocale, 'en');
  assert.equal(config.translationFiles, '.lingva/translations/{locale}.json');
});

test('configureLingvaNextClient merges a generated project into runtime config', () => {
  const project = defineLingvaProject({
    defaultLocale: 'en',
    resources: {
      en: {
        app: {
          title: 'Hello',
        },
      },
    },
  });
  const config = configureLingvaNextClient({
    config: {
      defaultLocale: 'en',
      fallbackLocale: 'en',
      locale: 'en',
      delivery: {
        mode: 'local',
        path: '.lingva/translations/{locale}.json',
      },
    },
    project,
    register: false,
  });

  assert.equal(config.project, project);
  assert.equal(config.defaultLocale, 'en');
});

test('createLingvaNextProvider creates a named provider component', () => {
  const project = defineLingvaProject({
    defaultLocale: 'en',
    resources: {
      en: {
        app: {
          title: 'Hello',
        },
      },
    },
  });
  const Provider = createLingvaNextProvider({
    config: {
      defaultLocale: 'en',
      fallbackLocale: 'en',
      locale: 'en',
    },
    displayName: 'AppLingvaProvider',
    project,
  });

  assert.equal(Provider.displayName, 'AppLingvaProvider');
});
