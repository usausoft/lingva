import { LingvaText, useLocale, useTranslation } from '@lingva/react';
import type { resources } from '../.lingva/generated/project';

type StarterResources = typeof resources;

export function App() {
  const { locale, setLocale } = useLocale<StarterResources>();
  const { t } = useTranslation<StarterResources>();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <section className="mx-auto max-w-3xl rounded-[2rem] border border-cyan-300/20 bg-white/10 p-8 shadow-2xl shadow-cyan-950/40 backdrop-blur">
        <p className="text-sm font-semibold tracking-[0.3em] text-cyan-200 uppercase">{t('app.badge')}</p>
        <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">
          <LingvaText keyName="app.title" />
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-200">
          <LingvaText keyName="app.subtitle" />
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <label className="text-sm font-semibold text-slate-200">
            {t('app.locale')}
            <select
              className="ml-3 rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-white"
              value={locale}
              onChange={(event) => setLocale(event.target.value as 'en' | 'ru')}
            >
              <option value="en">English</option>
              <option value="ru">Русский</option>
            </select>
          </label>
          <a
            className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
            href="/admin/users"
          >
            {t('app.cta')}
          </a>
        </div>

        <aside className="mt-10 rounded-3xl border border-white/10 bg-slate-900/80 p-5">
          <h2 className="text-xl font-bold">{t('dashboard.card.title')}</h2>
          <p className="mt-2 leading-7 text-slate-300">{t('dashboard.card.body')}</p>
        </aside>
      </section>
    </main>
  );
}
