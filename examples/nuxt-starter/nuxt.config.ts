export default defineNuxtConfig({
  compatibilityDate: '2026-09-25',
  devtools: { enabled: false },
  ssr: true,
  // The build script runs mandatory typecheck before bundling; Vite checker
  // shell-splits absolute project paths containing spaces.
  typescript: { typeCheck: false },
});
