import { get } from 'svelte/store';
import { createLingvaSvelteServer } from '@lingva/svelte';
import { redirect } from '@sveltejs/kit';
import lingvaConfig from '../../lingva.config';
import lingvaProject, { type resources } from '../../.lingva/generated/project';
import { LOCALE_COOKIE, resolveStarterLocale } from '#lib/locale.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
  const locale = resolveStarterLocale(cookies.get(LOCALE_COOKIE));
  const lingva = await createLingvaSvelteServer<typeof resources>({
    ...lingvaConfig,
    locale,
    project: lingvaProject,
  });

  try {
    const t = get(lingva.t);
    return {
      badge: t('app.badge'),
      locale,
      localeEnglish: t('app.localeEnglish'),
      localeLabel: t('app.locale'),
      localeRussian: t('app.localeRussian'),
      subtitle: t('app.subtitle'),
      title: t('app.title'),
    };
  } finally {
    lingva.runtime.destroy();
  }
};

export const actions: Actions = {
  locale: async ({ cookies, request }) => {
    const form = await request.formData();
    const locale = resolveStarterLocale(String(form.get('locale') ?? ''));
    cookies.set(LOCALE_COOKIE, locale, { path: '/', sameSite: 'lax' });
    redirect(303, '/');
  },
};
