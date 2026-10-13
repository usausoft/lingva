---
sidebar_position: 10
---

# Справочник клиентского CLI

Движок `lingva` на Rust выполняет все клиентские команды. `@lingva/cli` (npm) и `lingva-cli` (Python) устанавливают и запускают один и тот же движок. `lingva-sdk` — библиотека для приложений Python, а не установщик CLI.

Этот справочник описывает CLI `0.1.5` и Python SDK `0.1.5`, содержащий только библиотеку для приложений. В старых установленных пакетах набор команд может быть меньше. Проверьте `lingva --version` и `lingva <command> --help`.

## Установка и конфигурация {#installation-and-configuration}

### Homebrew (macOS и Linux) {#homebrew-macos-and-linux}

```bash
brew install usausoft/tap/lingva
lingva --version
lingva --help
```

[Публичный tap](https://github.com/usausoft/homebrew-tap) устанавливает тот же движок Rust, включая бинарный файл для Apple Silicon. Для команд ниже нужна версия **0.1.5** или новее; после обновления проверьте её через `lingva --version`. Обновление: `brew update && brew upgrade lingva`; удаление: `brew uninstall lingva`.

Homebrew устанавливает самостоятельный клиентский CLI на Rust. Библиотеки для фреймворков и механизм npm для исполняемых конфигураций JS/TS в него не входят. Используйте переносимые конфигурации YAML/JSON. Ежедневное обновление tap отслеживает новые стабильные версии npm CLI только после появления публичных архивов и контрольных сумм; оно никогда не понижает исходную версию. Начальные архивы 0.1.3 доступны публично в tap без изменений относительно исходного релиза GitHub. Для установки не нужны учётные данные частного GitHub.

### npm, Python или Rust {#npm-python-or-rust}

Выберите один способ установки:

```bash
pnpm add -D --allow-build=@lingva/cli @lingva/cli@0.1.5
pnpm exec lingva --version

python -m pip install lingva-cli
lingva --version

# Compiles the same executable; requires Rust.
cargo install lingva
```

При миграции Python сначала обновите `lingva-sdk` до версии, содержащей только библиотеку для приложений, затем установите или принудительно переустановите `lingva-cli`. Старые версии SDK предоставляли тот же консольный скрипт; их последующее удаление могло удалить и его.

Готовые бинарные файлы поддерживают macOS arm64/x64, Linux arm64 GNU/x64 musl и Windows x64. npm извлекает встроенный движок с проверкой контрольной суммы на этапе postinstall. Приведённая команда pnpm разрешает установочный скрипт только этого пакета. Для существующей установки выполните `pnpm approve-builds`, выберите `@lingva/cli`, затем проверьте `pnpm exec lingva --version`. Python загружает движок при первом запуске, проверяет целостность кэша при каждом запуске и затем может работать без сети. Неподдерживаемые платформы вызывают явную ошибку; альтернативный путь — сборка из исходников Rust.

`LINGVA_CLI_BINARY` явно выбирает существующий исполняемый файл. Если указанный файл отсутствует, возникает ошибка без перехода к другому варианту. `LINGVA_CLI_VERSION` выбирает другую семантическую версию движка; `LINGVA_CLI_ASSET_BASE_URL` — доверенное зеркало архивов. Python также поддерживает `LINGVA_CLI_CACHE_DIR`. Контрольные суммы обнаруживают повреждение, но не подтверждают подлинность, если сам канал релизов скомпрометирован.

Создайте одну переносимую конфигурацию `lingva.config.yaml` для каждого проекта:

```yaml
projectId: my-service
environment: dev
locales: [en, ru]
defaultLocale: en
fallbackLocale: en
translationFiles: .lingva/translations/{locale}.json
metadataFile: .lingva/metadata.json
apiKeyEnv: LINGVA_API_KEY
# For hosted transfer, add your project publish/delivery endpoint:
# apiUrl: https://your-project-api.example
cli:
  validate:
    failOn: error
  validatePolicies:
    release:
      failOn: warning
      maxIssues: 100
  extract:
    failOn: missing
  extractPolicies:
    release:
      failOn: any
  authoring:
    apiUrl: https://your-authoring-api.example
  publish:
    apiUrl: https://your-publish-api.example
  invalidate:
    apiUrl: https://your-publish-api.example
```

`projectId` и `environment` не могут быть пустыми. Идентификаторы локалей должны быть безопасными сегментами имени файла или URL. Значения по умолчанию должны входить в `locales`; при нескольких локалях `translationFiles` должен содержать `{locale}`. Пути разрешаются относительно конфигурации, а не рабочего каталога оболочки. Отсутствующие словари локалей изначально считаются пустыми. Храните секреты в переменных окружения или сохранённых учётных данных, а не в YAML.

Большинство команд проекта принимают необязательный путь к конфигурации первым аргументом; по умолчанию это `lingva.config.yaml`. Адаптер npm также вычисляет доверенную конфигурацию JS/TS, если она выбрана явно или обнаружена при отсутствии YAML. Он создаёт рядом с ней закрытый временный переносимый документ и удаляет его после выполнения. JavaScript отвечает только за вычисление конфигурации; поведение команд реализовано на Rust. Исполняемые конфигурации со встроенными ресурсами поддерживают просмотр и проверки без записи, но для постоянных изменений нужны файловые `translationFiles` или переносимый документ JSON/YAML, владеющий ресурсами. Адаптер отклоняет изменения одноразовых встроенных снимков JS/TS, чтобы не сообщать об изменениях, которые исчезнут при очистке. Самостоятельный CLI и Python отвергают исполняемые конфигурации JS/TS. Не храните эквивалентные конфигурации YAML и TypeScript в одном каталоге.

Нормализованные экспорты JSON также можно использовать как конфигурации: `resources` сопоставляет идентификаторы локалей со словарями. `apply`, `approve`, `sync` и обычный `pull` обновляют этот документ со встроенными ресурсами, а не неиспользуемые дублирующие файлы локалей.

## Аутентификация: `auth` {#authentication-auth}

Команды для размещённого сервиса принимают переопределения `--api-url` и `--auth-token`. Явные токены имеют приоритет над ключами окружения и конфигурации и сохранёнными учётными данными. Не допускайте попадания токенов в журналы и историю оболочки; CI должен передавать маскируемые секреты окружения.

```bash
lingva auth login
lingva auth login --platform-url https://stage.lingva.dev --no-browser
lingva auth login --issuer-url "$ISSUER" --client-id "$CLIENT_ID"
lingva auth use-key --api-key "$LINGVA_API_KEY" --project-id my-service
lingva auth status --format json
lingva auth logout
```

Вход через браузер получает настройки issuer и клиента от платформы и использует PKCE. `--port` меняет порт локального обратного вызова. `--scope`, `--authorize-url` и `--token-url` при необходимости переопределяют настройки провайдера. Все адаптеры используют общие учётные данные в `~/.lingva/credentials.json`; в Unix доступ к файлу ограничен владельцем. Истёкшие учётные данные OAuth обновляются, если провайдер выдал refresh token. `use-key` подходит для неинтерактивной работы CI.

Вход с устройства требует OAuth-провайдера, который действительно поддерживает device grants; эта команда сама не включает авторизацию устройств на платформе:

```bash
lingva auth login --device --device-url "$DEVICE_AUTH_URL" \
  --issuer-url "$ISSUER" --client-id "$CLIENT_ID"
```

## Настройка и обновления: `init`, `update` {#setup-and-upgrades-init-update}

```bash
# Authenticated remote setup, default mode; discovers visible projects.
lingva init --sdk react

# Explicit account-free local setup.
lingva init --mode local --no-auth --sdk python \
  --project-id my-service --locale en,ru

# CI never prompts. Supply all identity/endpoint values explicitly.
lingva init --non-interactive --project-id my-service --locale en,ru \
  --environment stage --api-url "$LINGVA_PUBLISH_API_URL"

# Inspect files before writing; --force explicitly permits replacement.
lingva init --mode local --no-auth --dry-run --format json
lingva init --mode local --no-auth --sdk next --ci github
lingva init --mode local --no-auth --sdk react \
  --config config/lingva.config.yaml --locales-dir locales \
  --provider-file src/i18n/provider.tsx --bundle-url "$BUNDLE_URL"
lingva init --wizard --mode local --no-auth
lingva update --format json
```

`--sdk` принимает `vanilla`, `react`, `next`, `angular`, `vue`, `svelte`, `python`, `swift`, `kotlin` и `flutter`; последние три создают переносимые заготовки для предварительных версий библиотек, доступных в исходниках. `--framework` — псевдоним. `--default-locale`, `--fallback-locale`, `--translation-files` и `--platform-url` меняют значения по умолчанию. `--wizard` требует терминал и несовместим с `--non-interactive`. Заготовка локального CI использует самостоятельный установщик и проверку `check` без записи и без аккаунта платформы. `--config-file` (псевдоним `--config`) указывает только переносимый YAML/JSON. Заготовки JavaScript создают `.lingva/generated/runtime.ts` и адаптеры провайдеров, а не второй эквивалентный `lingva.config.ts` рядом с переносимым источником. Существующие доверенные конфигурации JS/TS, написанные вручную, по-прежнему поддерживаются через механизм вычисления npm. `update` сообщает команду обновления, но ничего не устанавливает автоматически. Адаптеры npm и Python указывают свой канал установки. Python проверяет PyPI; Cargo — crates.io; самостоятельный CLI, npm и Homebrew — стабильный канал движка npm. Для переопределения определения канала используйте `--channel standalone|npm|python|homebrew|cargo` или `LINGVA_CLI_INSTALL_CHANNEL`. Команды обновления самостоятельного CLI фиксируют версии установщика и бинарного архива. Сгенерированные проверки Linux CI также фиксируют версию создавшего их движка. Обновления Homebrew зависят от доступности версии в tap.

## Локальное редактирование: `sync`, `check`, `validate`, `metadata`, `apply` {#local-authoring-sync-check-validate-metadata-apply}

```bash
lingva sync
lingva sync path/to/lingva.config.yaml --format json
lingva check --format json
lingva validate --fail-on warning --max-issues 50 --format json
lingva validate --policy release
lingva validate projects --glob 'lingva.config.yaml' --fail-on error
lingva validate --only invalid_translation_key,invalid_translation_contract
lingva validate --ignore missing_key_metadata
lingva metadata --dry-run --format json
lingva metadata --check
lingva metadata --status draft --output .lingva/metadata.json
lingva apply --locale ru --input reviewed/ru.json
lingva apply --locale en --input reviewed/en.json --no-sync
```

`sync` следует структуре ключей и вариантов локали по умолчанию. Она сохраняет существующие переводы, добавляет отсутствующие строки как пустые значения и выравнивает идентификаторы вариантов и описательные метаданные. Все входные данные локалей проверяются до записи. Пакетные изменения файлов используют закрытый журнал отката и блокировку записи в каталог проекта. При ошибке восстанавливаются прежние байты, включая удаление новых файлов локалей. Следующая загрузка конфигурации восстанавливает прерванную операцию до чтения переводов. Добавьте `.lingva/translation-transaction.json` в gitignore; не удаляйте его после ошибки. Если доступ к файловой системе мешает откату, исправьте права и повторите команду. Это локальное восстановление, а не транзакция размещённого API. `sync` не пересоздаёт адаптеры фреймворков, сгенерированные импорты проекта или конфигурацию библиотеки. При изменении локалей или идентификаторов обновляйте их явно; перед `--force` изучите предварительный результат init и последствия замены.

`check` ничего не записывает и завершается ошибкой при расхождении структуры даже с `--fail-on none` для валидации. `validate` также работает только на чтение и поддерживает пороги `none`, `error`, `warning`, `info` и `variant-drift`. `--max-issues` ограничивает только отображение и никогда не скрывает ошибку. `--config` выбирает другую конфигурацию проекта с настройками политик. Явные флаги имеют приоритет над значениями именованных политик.

Коды проблем валидации: `invalid_translation_key`, `invalid_translation_contract`, `missing_default_translation`, `missing_locale_translation`, `translation_contract_mismatch`, `missing_key_metadata`, `missing_key_description`, `missing_workflow_status`, `translated_key_missing_translator`, `reviewed_key_missing_reviewer`, `namespace_mismatch`, `missing_locale_variant`, `extra_locale_variant` и `variant_metadata_mismatch`. Используйте именно эти значения с `--only` и `--ignore`.

`metadata` создаёт метаданные ключей локали по умолчанию, сохраняя существующие описания, рецензентов и статусы. `--check` сообщает об отсутствующих метаданных и возвращает статус ошибки; `--dry-run` ничего не записывает. `--output` задаёт файл метаданных, а не отчёт. Статусы: `draft`, `translated`, `reviewed` и `approved`.

`apply` принимает JSON-объект локали. Для локали по умолчанию входные данные изменяют существующие ключи и синхронизируют другие локали, если не задан `--no-sync`. Для другой локали они заменяют её словарь, после чего добавляются отсутствующие исходные ключи; включите все переводы, которые хотите сохранить. Поддеревья пространств имён никогда не удаляются неявно.

Конечные значения переводов — строки или непустые массивы вариантов `{id, text}`. Идентификаторы вариантов уникальны. Развёрнутые ключи содержат не более 200 ASCII-символов, начинаются с буквы или цифры, используют только буквы, цифры, `.`, `_`, `-` и не содержат последовательных или завершающих точек. Коллизии точечных и вложенных ключей вызывают ошибку.

## Отчёты и генерируемые артефакты {#reports-and-generated-artifacts}

```bash
lingva manifest --format json --output artifacts/manifest.json
lingva bundle --locale ru --format json --output artifacts/ru.bundle.json
lingva bundle --locale en --no-metadata
lingva workflow --format json --output artifacts/workflow.json
lingva types --output src/generated/lingva-types.ts
lingva helpers --output src/generated/lingva-helpers.ts --no-metadata
lingva export --format json --output artifacts/project.json
lingva import artifacts/project.json --output imported.project.json
lingva import resources.json --project imported.project.json \
  --project-id my-service --output merged.project.json
lingva studio --output artifacts/studio.html
```

`manifest` описывает ключи, наличие локалей, переменные и метаданные. `bundle` ищет значение в запрошенной локали, резервной локали, затем локали по умолчанию и фиксирует ключи с резервными значениями. `workflow` сообщает статусы метаданных и списки ожидающих перевода или проверки. `types` создаёт типы TypeScript для локалей, ключей и переменных; `helpers` добавляет типизированные функции поиска и проверки наличия. По умолчанию результат — исходный код, а не обёртка JSON. `--no-metadata` исключает метаданные из пакетов и генерируемых контрактов, где это применимо.

`export` нормализует ресурсы и идентификаторы проекта в JSON. `import` принимает этот формат или простую карту ресурсов `{locale: dictionary}`, объединяет переданные ресурсы с `--project`, проверяет результат и выводит JSON. Она не выполняет JavaScript и не перезаписывает исходные файлы переводов неявно.

`studio` создаёт самостоятельный офлайн-редактор JSON локалей в HTML. Откройте файл в браузере, измените строки или массивы вариантов, экспортируйте локаль и примените `apply`. Редактирование HTML не сохраняет изменения в репозитории или размещённом проекте. Это редактор JSON, а не размещённая панель переводов.

## Статическая проверка исходников: `extract` {#static-source-checks-extract}

```bash
lingva extract src --format json --output artifacts/usage.json
lingva extract src --project lingva.config.yaml --fail-on missing
lingva extract src --project lingva.config.yaml --policy release
lingva extract src --project lingva.config.yaml --fail-on any \
  --extensions ts,tsx,js,jsx --exclude '**/fixtures/*,**/*.test.ts'
lingva extract src --callee lingva.t,lingva.tSync --fail-on dynamic
```

Извлечение разбирает синтаксис JS/TS и собирает литералы первых аргументов `t` и `tSync`, включая вызовы методов и статические шаблоны. Комментарии, литералы регулярных выражений, текст JSX и строки, не являющиеся кодом, игнорируются. Динамические аргументы попадают в `dynamicCalls` с файлом и номером строки; они никогда не вычисляются в ключи. Привязка символов не выполняется. Используйте `--callee` (или `callees` в политике), чтобы выбрать точные цели вызовов и исключить посторонние функции `t`. По умолчанию учитываются любые получатели `t`/`tSync`. Некорректный синтаксис исходников вызывает ошибку. Каталоги `node_modules`, `.git`, `.lingva`, `target`, `dist`, `.next` и символические ссылки пропускаются. Шаблоны путей поддерживают `*` и `?`, а не регулярные выражения. `--fail-on` принимает `missing`, `unused`, `dynamic`, `any` или `none`. `any` включает динамические вызовы. Сравнение отсутствующих и неиспользуемых ключей требует `--project`; проверка динамических вызовов — нет. `--config` задаёт другую конфигурацию проекта с политиками извлечения.

## Обмен с размещённым сервисом: `pull`, `push`, `publish`, `invalidate` {#hosted-transfer-pull-push-publish-invalidate}

```bash
lingva pull --locale ru --format json
lingva pull --api-url "$DELIVERY_URL" --auth-token "$LINGVA_API_KEY"
lingva push --api-url "$PUBLISH_URL" --auth-token "$LINGVA_API_KEY"
lingva push --locale en,ru --environment stage --invalidate \
  --source repository --reason 'Reviewed release'
lingva publish --local-only --output-dir artifacts/publish --format json
lingva publish --api-url "$PUBLISH_URL" --environment stage --format json
lingva invalidate --api-url "$PUBLISH_URL" --environment stage \
  --source manual --reason 'External deployment'
```

`pull` загружает созданные переводы, исключая значения, полученные только через резервную локаль, и использует `.lingva/remote-state.json` для трёхстороннего слияния. Все загрузки и слияния завершаются до записи. Конфликт локальных и удалённых изменений вызывает ошибку без записи. `--output` принимает шаблон назначения с `{locale}` для нескольких локалей. Обычный pull обновляет фактический источник ресурсов проекта.

`push` публикует выбранные локали со стабильным семантическим идентификатором изменения и последней общей удалённой ревизией. Устаревшая запись получает HTTP `409`; `--force` снимает эту защиту и означает намеренную перезапись. Одинаковые повторы идемпотентны. Состояние обновляется только после подтверждения опубликованной ревизии. Не включайте файл состояния в Git. `--output-dir` также сохраняет ответ публикации. `--invalidate` отправляет уведомление об обновлении только после успешной публикации и сохранения состояния; оно никогда не отправляется неявно.

`publish` создаёт файлы манифеста и пакетов через `--output-dir`. Без настроенного адреса сервиса это офлайн-генерация артефактов. С `apiUrl`, `cli.publish.apiUrl` или `--api-url` она также публикует через тот же механизм защиты ревизий, что и `push`. `invalidate` явно сообщает о внешнем обновлении. Значения источника: `repository`, `dashboard` и `manual`; используйте одно окружение на всех этапах.

`--dry-run` проверяет и выводит артефакты, не записывая выходные файлы и не обращаясь к размещённому сервису. `--local-only` записывает запрошенные артефакты и отчёты, но никогда не публикует, даже с настроенным адресом. Эти флаги несовместимы. Без них `--output-dir` не предотвращает удалённую публикацию.

```bash
lingva publish --dry-run --format json
lingva publish --local-only --output-dir artifacts/plan
```

Шаблоны валидации каталогов выбирают только переносимые конфигурации YAML/JSON; механизм npm не вычисляет рекурсивно каждую исполняемую конфигурацию, найденную в каталоге.

## Проверка удалённых переводов: `drafts`, `approve` {#hosted-review-drafts-approve}

```bash
lingva drafts --api-url "$AUTHORING_URL" --locale ru --status draft \
  --limit 25 --format json
lingva drafts --status all --next-token "$NEXT_TOKEN" --output-dir review
lingva approve --draft review/translation.draft.json --dry-run --format json
lingva approve --draft review/translation.draft.json --no-mark-approved
lingva approve --draft-id "$DRAFT_ID" --api-url "$AUTHORING_URL" \
  --approved-by reviewer@example.com --push --publish-api-url "$PUBLISH_URL" \
  --publish-auth-token "$LINGVA_API_KEY" --invalidate --reason 'Reviewed'
```

`drafts` возвращает одну страницу; для следующей передайте полученный `nextToken`. `--include-approved` включает проверенные черновики; `--key` фильтрует один ключ. `--limit` задаёт значение 1–100. Имена экспортируемых файлов используют хеш недоверенных идентификаторов вместо трактовки их как путей. `approve --draft-id` просматривает страницы до нужного черновика и отвергает повторяющиеся токены страниц. Локальному черновику нужны строки `locale`, `key`, `value`, а для вариантов — `variantId`; необязательные идентификаторы проекта и окружения должны совпадать.

`approve` перед применением проверяет область действия, локаль, ключ, значение и структуру варианта. Замена пространства имён запрещена. `--dry-run` не применяет, не помечает и не публикует изменения. `--no-sync` пропускает выравнивание схемы и несовместим с `--push`. Удалённые черновики помечаются одобренными, если не указан `--no-mark-approved`. Если этот этап завершается ошибкой после локального применения, сообщение явно указывает это и публикация не выполняется. `--push` явно публикует результат; `--invalidate` требует `--push`. Редактирование и публикация могут использовать разные адреса и токены. Устраните ошибку и повторите неудачный этап; локальное применение и удалённое одобрение не составляют распределённую транзакцию.

## Автоматизация {#automation}

Для отчётов предпочитайте `--format json`. `--output` сохраняет отчёт или артефакт там, где это поддерживается. `--no-summary` скрывает строки краткого описания для человека, но не содержимое артефакта. Некорректные флаги возвращают код 2; ошибки команд и проверок — 1; успех — 0. Адаптеры сохраняют код движка. Сетевые операции ограничены тайм-аутами и возвращают явные ошибки вместо незаметного перехода к другой реализации.
