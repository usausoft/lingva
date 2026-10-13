---
sidebar_position: 3
---

# Конфигурация

Переносимый контракт CLI Lingva — `lingva.config.yaml`. Он декларативен и работает без изменений в JavaScript, Python и CI. Библиотеки для фреймворков JavaScript также могут использовать `lingva.config.ts`, когда нужны типизированные импорты; этот адаптер приложения отделён от независимого от языка контракта CLI.

## Единый интерфейс CLI для всех языков {#one-cli-interface-across-languages}

Исполняемый файл всегда называется `lingva`. Прямая установка, npm и PyPI запускают один и тот же самостоятельный движок Rust:

| Сценарий                    | Команда        |
| --------------------------- | -------------- |
| Инициализация               | `lingva init`  |
| Выравнивание файлов локалей | `lingva sync`  |
| Проверка CI                 | `lingva check` |
| Загрузка удалённой копии    | `lingva pull`  |
| Публикация локальной копии  | `lingva push`  |

По умолчанию инициализация использует удалённый режим:

```bash
lingva auth login
lingva init --sdk python
```

Для другого развёртывания Lingva используйте `--platform-url https://stage.lingva.dev`. `--mode local --no-auth` подходит только для локального проекта без аккаунта. В CI выполните аутентификацию через `auth use-key`, добавьте `--non-interactive` и передайте явные параметры проекта и API со страницы настройки проекта.

Конфигурация YAML не содержит исполняемого кода:

```yaml
projectId: lingva-app
environment: stage
locales:
  - en
  - ru
defaultLocale: en
fallbackLocale: en
translationFiles: .lingva/translations/{locale}.json
apiUrl: https://your-publish-api.lambda-url.eu-west-1.on.aws
apiKeyEnv: LINGVA_API_KEY
```

Храните учётные данные в указанной переменной окружения, а не в этом файле. Общий контракт охватывает локальные sync/check и удалённые pull/push. Настройка библиотек для фреймворков остаётся специфичной для языка: провайдеры React и жизненный цикл приложения Python решают разные задачи.

Для `sync`, `check`, `pull` и `push` путь к конфигурации необязателен. По умолчанию Lingva читает `lingva.config.yaml` из текущего корня проекта. Передавайте путь только при другом имени или расположении файла.

Не поддерживайте эквивалентные файлы YAML и TypeScript в одном каталоге. Команды без аргументов намеренно отдают приоритет YAML. Выбирайте YAML для переносимого процесса CLI; TypeScript — когда библиотека JavaScript импортирует конфигурацию напрямую.

Установите CLI перед выполнением команд из этого руководства:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://unpkg.com/@lingva/cli@latest/lingva-installer.sh | sh
```

Установщик Python CLI отделён от библиотеки для приложений:

```bash
python -m pip install lingva-cli
```

Разработчики Rust могут напрямую скомпилировать опубликованный crate:

```bash
cargo install lingva
```

Самостоятельные установщики остаются рекомендуемым способом для клиентов: они устанавливают готовый бинарный файл с проверкой контрольной суммы и не требуют инструментов разработки для какого-либо языка.

CLI на Rust реализует все 23 клиентские команды, включая извлечение ключей, генерацию кода, метаданные, редактирование и studio. npm и PyPI — адаптеры запуска с проверкой контрольных сумм, а не отдельные реализации. Заготовки для фреймворков создаёт Rust. Для этих команд нужна версия CLI 0.1.5 или новее; проверьте `lingva --version`. Примеры, параметры политик, обработку ошибок и совместимость адаптеров смотрите в [полном справочнике команд](./cli.md). Только npm вычисляет исполняемые конфигурации JS/TS через временный переносимый документ.

Запустите `lingva update`, чтобы проверить стабильный релиз для вашего канала установки. Python использует PyPI, Cargo — crates.io, а самостоятельный CLI, npm и Homebrew — метаданные стабильного движка npm. Команда сообщает способ обновления для канала без изменения установки. Используйте `--channel`, чтобы переопределить автоматическое определение.

Для процесса с локальными переводами конфигурация должна оставаться декларативной. Пользователю не нужно вручную импортировать каждый файл локали.

Явно создайте переносимую конфигурацию YAML:

```bash
lingva init --sdk python
```

Для приложений React и Next.js можно вместо этого создать типизированный адаптер TypeScript в `.lingva/generated/runtime.ts` вместе с первой обёрткой провайдера. Переносимый YAML остаётся единственным корневым источником CLI; заготовка не создаёт рядом эквивалентный `lingva.config.ts`:

```bash
pnpm lingva init --sdk react
pnpm lingva init --sdk next
```

Для локальных проектов, которым нужна защита состояния переводов в pull request, попросите init добавить процесс GitHub Actions:

```bash
pnpm lingva init --mode local --no-auth --ci github
```

Сначала можно просмотреть создаваемые файлы:

```bash
pnpm lingva init --dry-run --format text
```

С `--ci github` локальная инициализация создаёт `.github/workflows/lingva-local.yml`. Этот процесс устанавливает самостоятельный бинарный файл с проверкой контрольной суммы и запускает `lingva check` для pull request без Node.js или Python.

## Локальный режим {#local-mode}

Используйте локальный режим, когда переводы хранятся в репозитории.

Пример заготовки:

```ts
import { defineLingvaConfig } from '@lingva/core';

const lingvaConfig = defineLingvaConfig({
  projectId: 'lingva-app',
  locales: ['en', 'ru'],
  defaultLocale: 'en',
  locale: 'en',
  fallbackLocale: 'en',
  translationFiles: '.lingva/translations/{locale}.json',
  generatedProjectFile: '.lingva/generated/project.ts',
  metadataFile: '.lingva/metadata.json',
  delivery: {
    mode: 'local',
    path: '.lingva/translations/{locale}.json',
  },
});

export default lingvaConfig;
```

Эта конфигурация намеренно минимальна. JSON-файлы локалей находятся по шаблону `translationFiles`, а скрытым сгенерированным модулем проекта управляет сама Lingva.

Метаданные ключей тоже могут оставаться декларативными. `lingva init` не создаёт файл метаданных. Выполните `lingva metadata --output .lingva/metadata.json` и задайте `metadataFile: .lingva/metadata.json` в переносимой конфигурации. Если позже добавятся ключи локали по умолчанию, создайте отсутствующие метаданные без перезаписи существующих записей:

```bash
pnpm lingva metadata lingva.config.yaml --output .lingva/metadata.json
pnpm lingva sync lingva.config.yaml
pnpm lingva check lingva.config.yaml
```

Новые ключи получают статус `draft` и описания TODO. Обновляйте описания, теги, сведения о переводчике и рецензенте по мере прохождения текста через ваш процесс.

CI может проверять расхождения метаданных без записи файлов:

```bash
pnpm lingva metadata lingva.config.yaml --check
```

Локальные файлы переводов хранятся по стандартному пути в репозитории:

```json
{
  "common": {
    "appName": "Lingva app",
    "welcome": "Welcome"
  },
  "auth": {
    "signIn": {
      "title": "Sign in"
    }
  }
}
```

Во время выполнения `common.welcome` и вложенные ресурсы разрешаются по одному контракту путей с точками.

## Контракт ключей перевода {#translation-key-contract}

Все интеграции Lingva используют одинаковые правила развёрнутых ключей перевода:

- не более 200 символов
- только буквы, цифры, точки, подчёркивания и дефисы
- первый символ — буква или цифра
- без завершающей точки и последовательных точек

Например, `docs.python.getting-started_1` допустим. Делайте ключ коротким стабильным идентификатором, даже если перевод — длинный абзац. Стоимость и квоты тарифов учитывают отдельные развёрнутые ключи, а не число символов в их значениях.

`lingva check` обнаруживает некорректные ключи до публикации. Размещённые API редактирования и публикации применяют тот же контракт, поэтому JavaScript, Python, CI и веб-редактор не создают несовместимое состояние переводов.

Конечные значения переводов должны быть строками или непустыми массивами вариантов. Пустые массивы, числа, логические значения, null, повторяющиеся идентификаторы вариантов и коллизии родительских точечных ключей вызывают ошибку до синхронизации или публикации, а не отбрасываются незаметно.

Lingva также поддерживает варианты конечных значений, когда одному ключу нужны разные тона или интонации. Тогда значение становится массивом типизированных объектов вариантов:

```json
{
  "marketing": {
    "hero": {
      "title": [
        {
          "id": "warm",
          "tone": "warm",
          "text": "Welcome back, {user.name}."
        },
        {
          "id": "bold",
          "tone": "bold",
          "text": "Let us ship today, {user.name}."
        }
      ]
    }
  }
}
```

Обращения во время выполнения по-прежнему используют тот же ключ:

```ts
t('marketing.hero.title', {
  variant: 'bold',
  variables: {
    user: {
      name: 'Nino',
    },
  },
});
```

Lingva проверяет, что остальные локали сохраняют тот же контракт конечного значения, что и локаль по умолчанию. Если в ней ключ использует варианты, в остальных локалях он также должен быть массивом вариантов. Валидация сообщает и о расхождениях вариантов: отсутствии варианта из локали по умолчанию, лишнем варианте или изменении метаданных контракта `tone`, `mood`, `intonation`, `label` или `context`.

## Процесс локального редактирования {#local-editing-workflow}

Текущий процесс работы с локальными переводами:

1. считайте файл локали по умолчанию источником истины
2. сначала редактируйте ключи в нём
3. запустите `lingva sync`
4. позвольте Lingva добавить отсутствующие ключи в другие локали без перезаписи существующих переводов

Чтобы выровнять локальные файлы с локалью по умолчанию без перезаписи существующих переводов:

```bash
pnpm lingva sync ./lingva.config.yaml
```

Эта команда:

- проверяет структуру локальной конфигурации
- гарантирует наличие ключей локали по умолчанию во всех целевых локалях
- сохраняет структуру массивов для ключей с вариантами тона или стиля
- отдельно сообщает об отсутствующих и лишних вариантах и несовпадении метаданных вариантов
- сохраняет существующие переводы
- изменяет только JSON локалей; сгенерированные модули проекта JavaScript импортируют эти файлы

Чтобы использовать ту же логику в CI без записи файлов:

```bash
pnpm lingva sync ./lingva.config.yaml --check
```

Для обычной предварительной проверки локально и в CI предпочитайте объединённую команду:

```bash
pnpm lingva check ./lingva.config.yaml
```

Эта команда запускает синхронизацию в режиме проверки, проверяет итоговый контракт проекта и возвращает ненулевой код, если файлы локалей не синхронизированы или валидация превышает настроенный порог `--fail-on`.

Чтобы проверить итоговый контракт проекта:

```bash
pnpm lingva validate ./lingva.config.yaml
```

Этот путь валидации читает словари локалей переносимого проекта, проверяя отсутствующие ключи в локалях и несовпадения контрактов строковых значений и значений с вариантами.

Для CI, который должен завершаться ошибкой только при расхождении контракта переводов:

```bash
pnpm lingva validate ./lingva.config.yaml --fail-on variant-drift
```

## Удалённый режим {#remote-mode}

Удалённые `pull` и `push` используют оптимистический контроль конкурентных изменений. Движок Rust, запускаемый всеми способами установки, хранит последнюю удалённую ревизию и базовые словари в исключённом из Git файле `.lingva/remote-state.json`. `pull` выполняет трёхстороннее слияние по ключам перевода; локальные и удалённые изменения одного ключа вызывают ошибку без перезаписи файлов. `push` получает HTTP `409`, если удалённая ревизия изменилась. Повтор идентичного push возвращает существующую публикацию. Применяйте `--force` только для намеренной замены более нового удалённого состояния.

Используйте удалённый режим, когда пакеты должны загружаться из размещённого сервиса доставки Lingva.

```bash
pnpm lingva auth login
pnpm lingva init --project-id dashboard --api-url "$LINGVA_PUBLISH_API_URL"
```

Пример удалённой конфигурации:

```ts
import { defineLingvaConfig } from '@lingva/core';

const lingvaConfig = defineLingvaConfig({
  projectId: 'dashboard',
  environment: 'stage',
  locale: 'en',
  fallbackLocale: 'en',
  apiUrl: process.env.LINGVA_PUBLISH_API_URL,
  apiKey: process.env.LINGVA_API_KEY,
  delivery: {
    mode: 'cdn',
    url: 'https://example.lambda-url.eu-west-1.on.aws/bundles/{projectId}/{environment}/latest/{locale}.bundle.json',
    timeoutMs: 10_000,
  },
});

export default lingvaConfig;
```

У удалённого режима два правила безопасности:

- Для доставки в браузер используйте SDK-ключ проекта только с правом `delivery:read`; это идентификатор и средство контроля квоты и отзыва доступа, а не секрет браузера.
- Административные ключи проекта, токены публикации и редактирования должны оставаться в переменных окружения, доступных только серверу.

Скопируйте `LINGVA_PUBLISH_API_URL` и текущий URL пакета из целевого окружения на странице настройки проекта. У размещённых окружений отдельные адреса, поэтому удалённая инициализация намеренно не подставляет неявный URL API.

Удалённые HTTP-загрузки по умолчанию имеют тайм-аут 10 секунд. При необходимости задайте другое положительное значение `timeoutMs`. Императивные загрузки также принимают `AbortSignal`, например `client.preload(keys, locale, { signal })`, чтобы приложение могло отменить работу при завершении запроса или закрытии представления.

Рекомендуемый процесс настройки размещённого проекта:

1. создайте проект Lingva и откройте `/app/projects/<project-id>`
2. создайте SDK-ключ с `delivery:read` в **Consumer application setup**
3. скопируйте сгенерированную команду мастера или её идентификатор проекта, URL публикации и URL пакета
4. скопируйте сгенерированную команду `lingva auth login` для публикации локальным разработчиком
5. выполните `lingva check` и `lingva push --invalidate`
6. разверните приложение, предоставив браузеру только значения доставки с доступом на чтение

`lingva pull` загружает размещённые пакеты и трёхсторонне объединяет созданные переводы со словарями локалей проекта. Сначала настройте адрес публикации или доставки и учётные данные с доступом на чтение. Конфликт изменений одного ключа вызывает ошибку до записи; значения только из резервной локали не копируются в запрошенную локаль. Проверьте доставку через развёрнутый URL пакета и SDK-ключ с правом чтения.

Полный путь с готовыми командами приведён в [сценариях интеграции](/installation/integration-paths).

## Одна конфигурация для всех сценариев {#using-the-same-config-everywhere}

```ts
import { createLingvaJsRuntime } from '@lingva/js';
import lingvaConfig from './lingva.config';
import project from './.lingva/generated/project';

export const lingva = createLingvaJsRuntime({
  ...lingvaConfig,
  project,
});
```

Приложения React могут передать общую конфигурацию напрямую:

```tsx
import project from './.lingva/generated/project';
<LingvaProvider config={{ ...lingvaConfig, project }}>{children}</LingvaProvider>;
```

Либо в приложении, работающем только в браузере, настройте Lingva один раз, и `LingvaProvider` подхватит настройки автоматически. Эти значения общие для процесса; не используйте их для локалей или учётных данных отдельных SSR-запросов. На сервере передавайте явную конфигурацию, принадлежащую запросу:

```tsx
import { configureLingvaReact, LingvaProvider } from '@lingva/react';
import lingvaConfig from './lingva.config';
import project from './.lingva/generated/project';

configureLingvaReact({
  ...lingvaConfig,
  project,
});
<LingvaProvider>{children}</LingvaProvider>;
```

Или начните со сгенерированной обёртки:

```tsx
import { AppLingvaProvider } from './src/lingva/provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return <AppLingvaProvider>{children}</AppLingvaProvider>;
}
```

Проекты Next.js могут использовать специальный помощник, сгенерированный командой:

```bash
pnpm lingva init --mode local --no-auth --sdk next
```

Эта обёртка использует `createLingvaNextProvider` из `@lingva/next`; её можно подключить в `app/layout.tsx`.

Та же схема глобальных значений по умолчанию только для браузера доступна в обычном JavaScript и статических сайтах. Серверы должны создавать отдельные библиотеки для запросов с явной конфигурацией:

```ts
import { configureLingvaJs, createLingvaJsRuntime } from '@lingva/js';
import lingvaConfig from './lingva.config';
import project from './.lingva/generated/project';

configureLingvaJs({
  ...lingvaConfig,
  project,
});

const lingva = createLingvaJsRuntime();
```

Или используйте более высокоуровневые свойства runtime:

```tsx
<LingvaProvider
  runtime={{
    mode: 'remote',
    apiUrl: process.env.NEXT_PUBLIC_LINGVA_PUBLISH_API_URL,
    apiKey: process.env.NEXT_PUBLIC_LINGVA_API_KEY,
    projectId: 'dashboard',
    locale: 'en',
    fallbackLocale: 'en',
  }}
>
  {children}
</LingvaProvider>
```

Никогда не помещайте закрытые ключи записи или управления в переменные `NEXT_PUBLIC_*`. Если браузерному приложению нужен аутентифицированный доступ к Lingva, направьте запрос через свой сервер и добавьте закрытый токен там.

## Аутентификация CLI {#cli-auth}

Для размещённых процессов используйте вход CLI через браузер вместо вставки токена в каждую команду. Клиенты Lingva должны скопировать полную команду из **Consumer application setup** на странице проекта:

```bash
lingva auth login \
  --issuer-url https://auth.example.com \
  --client-id lingva-cli
```

CLI открывает браузер, завершает OAuth/OIDC-процесс с кодом авторизации и PKCE через `http://127.0.0.1:53682/callback` и сохраняет учётные данные в `~/.lingva/credentials.json` с закрытыми правами доступа к файлу. Зарегистрируйте этот localhost callback у провайдера удостоверений или передайте `--port`, если разрешён другой порт. Также можно явно задать адреса, если issuer не использует стандартную форму `/oauth2/*`:

```bash
lingva auth login \
  --authorize-url https://auth.example.com/oauth2/authorize \
  --token-url https://auth.example.com/oauth2/token \
  --client-id lingva-cli
```

После входа команды размещённого CLI используют сохранённый access token, если `--auth-token` не задан. Явные флаги и конфигурация проекта сохраняют приоритет, поэтому CI и автоматизация для отдельных окружений работают предсказуемо. Если провайдер возвращает refresh token, Lingva сохраняет адрес получения токенов и идентификатор клиента вместе с учётными данными и автоматически обновляет истёкшие access token перед удалёнными командами.

Поэтому после первого входа локальные команды рецензентов и сопровождающих могут выполняться без явного токена:

```bash
lingva drafts ./lingva.config.yaml \
  --api-url "$LINGVA_AUTHORING_API_URL" \
  --environment stage

lingva approve ./lingva.config.yaml \
  --draft-id draft_123 \
  --api-url "$LINGVA_AUTHORING_API_URL" \
  --publish-api-url "$LINGVA_PUBLISH_API_URL" \
  --push \
  --invalidate \
  --reason "Approved draft publish"
```

Оставьте `--auth-token` для CI, аварийной автоматизации и задач со служебными токенами. Не предоставляйте эти служебные токены коду браузера.

Для размещённых проектов используйте `lingva auth login`, чтобы получить настройки OAuth от Lingva. При необходимости выберите другое развёртывание через `--platform-url`.

```bash
lingva auth login
```

Для собственного OAuth-провайдера получите URL issuer и идентификатор клиента CLI у администратора рабочей области. Клиент должен поддерживать PKCE и локальный обратный вызов CLI. Передайте эти значения явно:

```bash
lingva auth login \
  --issuer-url "$LINGVA_CLI_AUTH_ISSUER_URL" \
  --client-id "$LINGVA_CLI_AUTH_CLIENT_ID"
```

Полезные команды аутентификации:

```bash
lingva auth status
lingva auth logout
```

Вход с устройства доступен только с провайдером, поддерживающим device grants. Он не включает этот тип доступа в Cognito. Для работы без графического интерфейса предоставьте API-ключ с подходящими правами или безопасно перенаправьте обратный вызов браузера. С провайдером, поддерживающим устройства:

```bash
lingva auth login \
  --issuer-url https://auth.example.com \
  --client-id lingva-cli \
  --device-url "$DEVICE_AUTH_URL" \
  --device
```

CLI выводит URL подтверждения и код пользователя, затем ждёт завершения одобрения в браузере.

## Артефакты доставки {#delivery-artifacts}

Когда нужны артефакты для CI, просмотра или размещённой доставки:

```bash
lingva bundle ./lingva.config.yaml --locale en --format json --output ./artifacts/lingva-bundle.en.json
```

Чтобы вместе создать манифест и пакеты:

```bash
lingva publish ./lingva.config.yaml --locale en,de --output-dir ./artifacts/publish
```

Чтобы отправить эти артефакты в размещённый API публикации Lingva:

```bash
lingva publish ./lingva.config.yaml \
  --locale en,de \
  --output-dir ./artifacts/publish \
  --api-url https://example.lambda-url.eu-west-1.on.aws/
```

Чтобы запросить обновление получателей после публикации:

```bash
lingva invalidate ./lingva.config.yaml \
  --api-url https://example.lambda-url.eu-west-1.on.aws/ \
  --source repository \
  --reason "Refresh after merge"
```

Чтобы объединить оба этапа в одно действие размещённой доставки:

```bash
lingva push ./lingva.config.yaml \
  --locale en,de \
  --output-dir ./artifacts/push \
  --api-url https://example.lambda-url.eu-west-1.on.aws/ \
  --invalidate \
  --source repository \
  --reason "Refresh after merge"
```

Для офлайн-просмотра артефактов сначала экспортируйте нормализованный проект:

```bash
lingva export lingva.config.yaml --format json --output .lingva/artifacts/plan/project.json
lingva publish .lingva/artifacts/plan/project.json --output-dir .lingva/artifacts/plan
```

Нормализованный экспорт включает ресурсы и исключает адреса сервисов, учётные данные и политики. Не добавляйте флаги адресов или переопределение размещённого `--config` ко второй команде. Она записывает артефакты локально без публикации в размещённый сервис.

## Что дальше {#what-comes-next}

Текущий процесс с локальными переводами уже подходит для разработки приложений, но некоторые возможности остаются предварительными:

- `lingva studio` — офлайн-редактор JSON; экспортируйте отредактированный JSON локали и примените его через `lingva apply`
- библиотеки Swift, Kotlin и Flutter доступны как предварительные исходники без встроенной аутентифицированной удалённой загрузки
- отдельные помощники перевода для Next.js Server Components не реализованы

Удалённые pull/push, одобрение черновиков и локальная валидация реализованы движком Rust. Действия команд и восстановление описаны в [справочнике CLI](./cli.md).
