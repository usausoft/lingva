Lingva CLI

Defaults:
  init uses remote mode and stored authentication; use --mode local --no-auth for an account-free project.
  sync only aligns local locale/key/variant structure. Use pull or push for hosted transfer.
  --non-interactive disables project/SDK prompts for CI.

Usage:
  lingva --help
  lingva --version
  lingva auth login [--platform-url <url>] [--issuer-url <url> | --authorize-url <url> --token-url <url>] [--client-id <id>] [--device] [--scope <list>] [--port <number>] [--no-browser]
  lingva auth use-key --api-key <project-api-key> [--project-id <id>] [--api-url <url>]
  lingva auth status
  lingva auth logout
  lingva init [--sdk angular|next|react|svelte|vanilla|vue|python|swift|kotlin|flutter] [--mode remote|local] [--no-auth] [--non-interactive] [--platform-url <url>] [--ci github] [--config-file <file>] [--locale <list>] [--default-locale <locale>] [--fallback-locale <locale>] [--project-id <id>] [--environment <name>] [--api-url <url>] [--bundle-url <url>] [--api-key-env <name>] [--translation-files <path-template>] [--provider-file <file>] [--dry-run] [--force] [--format text|json]
  lingva update [--channel standalone|npm|python|homebrew|cargo] [--format text|json]
  lingva sync [config-file] [--format text|json] [--dry-run] [--check]
  lingva metadata <config-file> [--output <file>] [--dry-run] [--check] [--format text|json]
  lingva check [config-file] [--format text|json] [--fail-on error|warning|info|variant-drift|none] [--only <codes>] [--ignore <codes>] [--max-issues <number>] [--output <file>]
  lingva studio <config-file> [--format html|json] [--output <file>]
  lingva apply <config-file> --locale <locale> --input <file> [--format text|json] [--no-sync]
  lingva approve <config-file> (--draft <file> | --draft-id <id>) [--api-url <url>] [--auth-token <token>] [--publish-api-url <url>] [--publish-auth-token <token>] [--environment <env>] [--approved-by <id>] [--push] [--force] [--invalidate] [--source dashboard|repository|manual] [--reason <text>] [--dry-run] [--format text|json] [--no-sync] [--no-mark-approved]
  lingva drafts <config-file> [--api-url <url>] [--auth-token <token>] [--environment <env>] [--locale <locale>] [--key <key>] [--status draft|approved|all] [--include-approved] [--limit <number>] [--next-token <token>] [--output-dir <dir>] [--format text|json]
  lingva pull [config-file] [--locale <list>] [--api-url <url>] [--auth-token <token>] [--format text|json] [--output <path-template>] [--no-summary]
  lingva validate <project-file-or-directory> [--config <file>] [--policy <name>] [--format text|json] [--glob <pattern>] [--fail-on error|warning|info|variant-drift|none] [--only <codes>] [--ignore <codes>] [--max-issues <number>] [--output <file>] [--no-summary]
  lingva bundle <project-file> --locale <locale> [--format text|json] [--output <file>] [--no-summary] [--no-metadata]
  lingva publish <project-file> [--config <file>] [--locale <list>] [--format text|json] [--output-dir <dir>] [--api-url <url>] [--auth-token <token>] [--dry-run | --local-only] [--force] [--no-summary] [--no-metadata]
  lingva push [config-file] [--config <file>] [--locale <list>] [--format text|json] [--output-dir <dir>] [--api-url <url>] [--auth-token <token>] [--force] [--invalidate] [--environment <env>] [--source dashboard|repository|manual] [--reason <text>] [--no-summary] [--no-metadata]
  lingva invalidate <project-file> [--config <file>] [--environment <env>] [--api-url <url>] [--auth-token <token>] [--source dashboard|repository|manual] [--reason <text>] [--format text|json]
  lingva manifest <project-file> [--format text|json] [--output <file>] [--no-summary]
  lingva workflow <project-file> [--format text|json] [--output <file>] [--no-summary]
  lingva types <project-file> [--output <file>] [--no-summary] [--no-metadata]
  lingva helpers <project-file> [--output <file>] [--no-summary] [--no-metadata]
  lingva export <project-file> [--output <file>]
  lingva import <resources-file> [--project <file>] [--output <file>]
  lingva extract <source-path> [--config <file>] [--policy <name>] [--project <file>] [--format text|json] [--output <file>] [--callee <list>] [--extensions <list>] [--exclude <patterns>] [--fail-on missing|unused|dynamic|any|none] [--no-summary]

Examples:
  lingva auth login
  lingva auth login --platform-url https://stage.lingva.dev
  lingva auth use-key --api-key "$LINGVA_API_KEY" --project-id dashboard
  lingva auth status
  lingva update
  lingva init # remote by default; selects an accessible project when needed
  lingva init --config-file ./config/lingva.config.yaml
  lingva init --mode local --no-auth --locale en,ru,de --translation-files .lingva/translations/{locale}.json
  lingva init --mode local --no-auth --sdk react
  lingva init --mode local --no-auth --sdk next
  lingva init --mode local --no-auth --sdk angular
  lingva init --mode local --no-auth --sdk vue
  lingva init --mode local --no-auth --sdk svelte
  lingva init --mode local --no-auth --sdk python
  lingva init --mode local --no-auth --ci github
  lingva init --mode remote --project-id dashboard --api-url "$LINGVA_PUBLISH_API_URL" --dry-run
  pnpm dlx @lingva/cli@latest init --wizard --mode remote --project-id dashboard --api-url "$LINGVA_PUBLISH_API_URL"
  lingva sync
  lingva sync ./lingva.config.ts
  lingva sync ./lingva.config.ts --check
  lingva metadata ./lingva.config.ts --output .lingva/metadata.json
  lingva metadata ./lingva.config.ts --check
  lingva check
  lingva check ./lingva.config.ts
  lingva check ./lingva.config.ts --format json --output ./artifacts/lingva-check.json
  lingva studio ./lingva.config.ts --output ./artifacts/lingva-studio.html
  lingva apply ./lingva.config.ts --locale en --input ./artifacts/en.json
  lingva approve ./lingva.config.ts --draft ./artifacts/draft.json
  lingva approve ./lingva.config.ts --draft-id draft_123 --api-url https://example.lambda-url.aws/
  lingva approve ./lingva.config.ts --draft-id draft_123 --api-url https://authoring.example --publish-api-url https://publish.example --push --invalidate
  lingva drafts ./lingva.config.ts --api-url https://example.lambda-url.aws/ --output-dir ./artifacts/drafts
  lingva pull
  lingva pull ./lingva.ts
  lingva pull ./lingva.ts --locale en,de
  lingva pull ./lingva.ts --output ./src/lingva/{locale}.json
  lingva validate ./lingva.project.mjs
  lingva validate ./packages --glob "*.project.mjs"
  lingva validate ./lingva.project.mjs --format json
  lingva validate ./lingva.project.mjs --fail-on warning
  lingva validate ./lingva.project.mjs --fail-on variant-drift
  lingva validate ./lingva.project.mjs --policy strict
  lingva validate ./lingva.project.mjs --config ./lingva.config.json --policy advisory
  lingva validate ./lingva.project.mjs --only missing_key_metadata,missing_key_description
  lingva validate ./packages --glob "*.project.mjs" --ignore missing_locale_translation --max-issues 10
  lingva validate ./lingva.project.mjs --format json --output ./artifacts/lingva-report.json
  lingva bundle ./lingva.project.mjs --locale de --format json --output ./artifacts/lingva-bundle.de.json
  lingva publish ./lingva.project.mjs --locale en,de --output-dir ./artifacts/publish
  lingva publish ./lingva.project.mjs --config ./lingva.ts --api-url https://example.lambda-url.aws/
  lingva push
  lingva push ./lingva.project.mjs --config ./lingva.ts --api-url https://example.lambda-url.aws/ --invalidate
  lingva invalidate ./lingva.project.mjs --config ./lingva.ts --source repository --reason "Refresh after merge"
  lingva manifest ./lingva.project.mjs --format json --output ./artifacts/lingva-manifest.json
  lingva workflow ./lingva.project.mjs --format text
  lingva types ./lingva.project.mjs --output ./src/generated/lingva.ts
  lingva helpers ./lingva.project.mjs --output ./src/generated/lingva-helpers.ts
  lingva export ./lingva.project.mjs --output ./artifacts/lingva-project.json
  lingva import ./translations.json --project ./lingva.project.mjs --output ./artifacts/lingva-merged.json
  lingva extract ./src --config ./lingva.config.json --policy ci --project ./packages/cli/fixtures/demo-project.mjs
  lingva extract ./src --exclude generated,__tests__
  lingva extract ./src --project ./packages/cli/fixtures/demo-project.mjs --fail-on any
