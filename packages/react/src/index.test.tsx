import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createLingvaResources, defineLingvaProject } from '@lingva/core';
import {
  clearLingvaReactConfiguration,
  configureLingvaReact,
  LingvaProvider,
  LingvaText,
  useLingva,
  useLocale,
  useTranslation,
} from './index';

const resources = createLingvaResources({
  en: {
    'site.title': 'Lingva',
    'site.subtitle': 'Language infrastructure for developers',
    banner: {
      cta: [
        {
          id: 'friendly',
          text: 'Try Lingva',
          tone: 'friendly',
        },
        {
          id: 'formal',
          text: 'Evaluate Lingva',
          tone: 'formal',
        },
      ],
    },
  },
  ru: {
    'site.title': 'Лингва',
    banner: {
      cta: [
        {
          id: 'friendly',
          text: 'Попробуйте Lingva',
          tone: 'friendly',
        },
        {
          id: 'formal',
          text: 'Оцените Lingva',
          tone: 'formal',
        },
      ],
    },
  },
});

const project = defineLingvaProject({
  projectId: 'react-test',
  resources,
  defaultLocale: 'en',
  fallbackLocale: 'en',
});

function TranslationProbe() {
  const { t, locale } = useTranslation<typeof resources>();
  const { client } = useLingva<typeof resources>();
  const localeState = useLocale<typeof resources>();

  return (
    <div data-client-locale={client.getLocale()} data-locale={locale} data-locale-hook={localeState.locale}>
      {t('site.title')}
    </div>
  );
}

test('LingvaProvider translates through runtime config and hooks', () => {
  const markup = renderToStaticMarkup(
    <LingvaProvider<typeof resources> config={{ project, locale: 'en' }}>
      <TranslationProbe />
    </LingvaProvider>
  );

  assert.match(markup, /Lingva/);
  assert.match(markup, /data-locale="en"/);
  assert.match(markup, /data-client-locale="en"/);
  assert.match(markup, /data-locale-hook="en"/);
});

test('LingvaProvider locale prop overrides the runtime config locale', () => {
  const markup = renderToStaticMarkup(
    <LingvaProvider<typeof resources> config={{ project, locale: 'en' }} locale="ru">
      <TranslationProbe />
    </LingvaProvider>
  );

  assert.match(markup, /Лингва/);
  assert.match(markup, /data-locale="ru"/);
  assert.match(markup, /data-client-locale="ru"/);
});

test('LingvaProvider accepts high-level runtime props', () => {
  const markup = renderToStaticMarkup(
    <LingvaProvider<typeof resources>
      runtime={{
        mode: 'local',
        project,
        locale: 'ru',
        fallbackLocale: 'en',
      }}
    >
      <TranslationProbe />
    </LingvaProvider>
  );

  assert.match(markup, /Лингва/);
  assert.match(markup, /data-locale="ru"/);
  assert.match(markup, /data-client-locale="ru"/);
});

test('LingvaProvider can use a registered default configuration', () => {
  configureLingvaReact<typeof resources>({
    project,
    locale: 'en',
  });

  const markup = renderToStaticMarkup(
    <LingvaProvider<typeof resources> locale="ru">
      <TranslationProbe />
    </LingvaProvider>
  );

  clearLingvaReactConfiguration();

  assert.match(markup, /Лингва/);
  assert.match(markup, /data-locale="ru"/);
  assert.match(markup, /data-client-locale="ru"/);
});

test('hooks fail loudly when LingvaProvider is missing', () => {
  function BrokenProbe() {
    useTranslation<typeof resources>();
    return null;
  }

  assert.throws(() => renderToStaticMarkup(<BrokenProbe />), {
    message: 'LingvaProvider is missing in the React tree.',
  });
});

test('LingvaText renders translated content', () => {
  const markup = renderToStaticMarkup(
    <LingvaProvider<typeof resources> config={{ project, locale: 'en' }}>
      <LingvaText<typeof resources> keyName="site.title" />
    </LingvaProvider>
  );

  assert.match(markup, /Lingva/);
});

test('LingvaText respects the requested variant', () => {
  const markup = renderToStaticMarkup(
    <LingvaProvider<typeof resources> config={{ project, locale: 'ru' }}>
      <LingvaText<typeof resources> keyName="banner.cta" variant="formal" />
    </LingvaProvider>
  );

  assert.match(markup, /Оцените Lingva/);
});
