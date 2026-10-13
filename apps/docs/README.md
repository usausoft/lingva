# Public documentation

The site publishes English (`en`) and Russian (`ru`) documentation. Both locales
build together with `pnpm --filter @lingva/docs build`.

## Content and navigation

English articles live in `docs/`. Full Russian counterparts use the same relative
paths under `i18n/ru/docusaurus-plugin-content-docs/current/`. Preserve frontmatter
IDs, slugs, code examples, and explicit heading IDs when translating. Heading IDs
stay identical across locales so existing fragment links continue to work.

For a new English article, run `pnpm --filter @lingva/docs write-heading-ids`, then
copy its structure and heading IDs into the translated article. Translate prose
and link labels; retain API names, commands, URLs, and executable examples.

`sidebars.ts` groups every article by reader task. Add each new article exactly
once. Existing document paths remain stable even when sidebar groups change.

## Lingva and Docusaurus responsibilities

Lingva owns site chrome and section labels through
`.lingva/translations/{en,ru}.json`. `src/site-text.ts` creates an isolated runtime
for the locale selected by Docusaurus, then destroys it after reading labels.

Docusaurus owns locale routes, complete Markdown articles, its built-in theme
translations, and the locale switcher. `@lingva/docusaurus` is a translation runtime
adapter; it does not translate Markdown or create locale routes automatically.

## Checks

Run from the repository root:

```bash
pnpm --filter @lingva/docs test
pnpm --filter @lingva/docs lint
pnpm --filter @lingva/docs typecheck
pnpm --filter @lingva/docs build
```

Tests reject missing Russian articles, changed code examples, mismatched heading
anchors, duplicate or missing navigation entries, and unsupported site locales.
Builds reject broken document links. Review both locales in the browser after
changing navigation or article structure.
