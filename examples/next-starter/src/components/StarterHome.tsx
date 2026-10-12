'use client';

import { LingvaText, useLocale, useTranslation } from '@lingva/next';
import type { resources } from '../../.lingva/generated/project';

type StarterResources = typeof resources;

const cardKeys = ['config', 'typing', 'delivery'] as const;

export function StarterHome() {
  const { locale, setLocale } = useLocale<StarterResources>();
  const { t } = useTranslation<StarterResources>();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <span className="rounded-md border border-border px-2 py-0.5 text-xs font-medium">{t('app.badge')}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t('app.locale')}</span>
            <select
              aria-label={t('app.locale')}
              value={locale}
              onChange={(event) => setLocale(event.target.value as 'en' | 'ru')}
              className="h-7 w-28 rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="en">English</option>
              <option value="ru">Русский</option>
            </select>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6">
        <div className="py-20">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            <LingvaText keyName="app.title" />
          </h1>
          <p className="mt-4 max-w-lg text-base text-muted-foreground">
            <LingvaText keyName="app.subtitle" />
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              href="https://lingva.dev/docs"
              target="_blank"
              rel="noreferrer"
            >
              {t('app.cta')}
            </a>
            <code className="rounded-md border border-border bg-muted px-3 py-1.5 font-mono text-sm text-muted-foreground">
              pnpm lingva init --framework next
            </code>
          </div>
        </div>

        <hr className="border-border" />

        <div className="grid gap-3 py-12 sm:grid-cols-3">
          {cardKeys.map((key) => (
            <section key={key} className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-semibold">{t(`cards.${key}.title`)}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t(`cards.${key}.body`)}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
