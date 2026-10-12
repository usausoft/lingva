import { createLingvaVue, createLingvaVueServer } from '@lingva/vue';
import { defineNuxtPlugin, useNuxtApp, useCookie } from '#imports';
import lingvaConfig from '../lingva.config';
import lingvaProject, { type resources } from '../.lingva/generated/project';

const STARTER_LOCALES = ['en', 'ru'] as const;
type StarterLocale = (typeof STARTER_LOCALES)[number];

function resolveStarterLocale(value: unknown): StarterLocale {
  return STARTER_LOCALES.includes(value as StarterLocale) ? (value as StarterLocale) : lingvaConfig.defaultLocale;
}

export default defineNuxtPlugin(async () => {
  const nuxtApp = useNuxtApp();
  const preference = useCookie<StarterLocale>('lingva-locale', {
    default: () => lingvaConfig.defaultLocale,
    sameSite: 'lax',
  });
  const locale = resolveStarterLocale(preference.value);
  const input = { ...lingvaConfig, locale, project: lingvaProject };
  const lingva = import.meta.server
    ? await createLingvaVueServer<typeof resources>(input)
    : createLingvaVue<typeof resources>(input);

  nuxtApp.vueApp.use(lingva);
  if (import.meta.server) {
    nuxtApp.hook('app:rendered', () => lingva.runtime.destroy());
  }
});
