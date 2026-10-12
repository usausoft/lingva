export const STARTER_LOCALES = ['en', 'ru'] as const;
export type StarterLocale = (typeof STARTER_LOCALES)[number];
export const LOCALE_COOKIE = 'lingva-locale';
export const DEFAULT_LOCALE: StarterLocale = 'en';

export function resolveStarterLocale(value: string | undefined): StarterLocale {
  return STARTER_LOCALES.includes(value as StarterLocale) ? (value as StarterLocale) : DEFAULT_LOCALE;
}
