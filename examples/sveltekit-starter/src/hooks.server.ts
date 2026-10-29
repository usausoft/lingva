import type { Handle } from '@sveltejs/kit/hooks';
import { LOCALE_COOKIE, resolveStarterLocale } from '#lib/locale.ts';

export const handle: Handle = ({ event, resolve }) => {
  const locale = resolveStarterLocale(event.cookies.get(LOCALE_COOKIE));
  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%lang%', locale),
  });
};
