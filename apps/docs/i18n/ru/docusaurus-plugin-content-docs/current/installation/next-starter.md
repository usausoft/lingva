---
sidebar_position: 5
---

# Стартовый проект Next.js

Используйте `examples/next-starter`, чтобы изучить текущую интеграцию Next.js
в настоящем приложении с App Router до подключения Lingva к своему продукту.
Пример работает внутри этого публичного монорепозитория, поскольку его зависимости
используют `workspace:*`. Он отличается от файлов, которые `lingva init` создаёт
в пользовательском приложении.

## Создание начальных файлов {#scaffold-it}

Выполните эти команды в корне существующего приложения Next.js:

```bash
pnpm add @lingva/core @lingva/react @lingva/next
pnpm add --save-dev --allow-build=@lingva/cli @lingva/cli
pnpm lingva init --mode local --no-auth --sdk next
pnpm lingva check
```

Команда создаёт переносимую конфигурацию `lingva.config.yaml`, типизированный адаптер
`.lingva/generated/runtime.ts`, локальные файлы переводов, сгенерированный проект
и обёртку провайдера. Она не создаёт приложение Next.js, не устанавливает SDK-пакеты
и не добавляет скрипты пакета, включённые в стартовый пример.

## Что демонстрирует пример {#what-it-covers}

Пример в репозитории демонстрирует:

- локальную конфигурацию `lingva.config.ts` (начальные файлы от init вместо неё используют переносимый YAML);
- `.lingva/translations/{locale}.json`;
- `.lingva/generated/project.ts`;
- `createLingvaNextProvider` из `@lingva/next`;
- `LingvaText`, `useTranslation` и `useLocale`;
- `.lingva/metadata.json` для проверки метаданных ключей без предупреждений;
- подключение провайдера Next.js App Router в `app/layout.tsx`;
- локальную проверку через `verify:starter` и `lingva check`.

Запускайте скрипты его пакета из корня монорепозитория:

```bash
pnpm --filter @lingva/example-next-starter verify:starter
pnpm --filter @lingva/example-next-starter lingva:check
pnpm --filter @lingva/example-next-starter dev
```

## Аналогичная начальная настройка {#scaffold-equivalent}

Для существующего приложения Next.js с установленными пакетами настройте локальный режим:

```bash
pnpm lingva init --mode local --no-auth --sdk next
```

Затем подключите сгенерированный `AppLingvaProvider` из `src/lingva/provider.tsx`
в макете App Router. Сгенерированный адаптер импортирует среду выполнения из
`.lingva/generated/runtime.ts`; корневая конфигурация TypeScript ему не нужна.

При добавлении ключей локали по умолчанию обновляйте метаданные до запуска CI:

```bash
pnpm lingva metadata lingva.config.yaml --output .lingva/metadata.json
pnpm lingva metadata lingva.config.yaml --check
pnpm lingva check
```

В примере из репозитория команды метаданных вместо этого должны обращаться
к существующему `lingva.config.ts`. Скрипты `verify:starter` и помощники удалённой
доставки принадлежат этому примеру и не создаются командой `init`.

## Последующий переход к удалённой доставке {#hosted-delivery-later}

Стартовый пример намеренно начинается с локального режима. Когда проект будет
готов к удалённой доставке, откройте `/app/projects/<project-id>` и скопируйте значения
из раздела **Consumer application setup**. Для примера из репозитория выполните
из корня монорепозитория:

```bash
cp examples/next-starter/.env.example examples/next-starter/.env.local
pnpm --filter @lingva/example-next-starter verify:hosted-env
```

Эта проверка читает файлы окружения примера, проверяет обязательные значения
настройки и отклоняет каждую переменную Lingva `NEXT_PUBLIC_*`, имя которой содержит
`TOKEN`, `KEY` или `SECRET`. Это консервативная проверка настройки, а не проверка
соединения с сервером или прав ключей. Браузерный SDK-ключ только для чтения требует
отдельной проверки браузерной конфигурации.

До обращения к размещённым сервисам сформируйте план публикации без изменения данных:

```bash
pnpm --filter @lingva/example-next-starter lingva:plan
```

Скрипт примера запускает локальные команды `manifest` и `bundle` для `en` и `ru`,
записывая артефакты в `.lingva/artifacts/plan` без запросов к платформе
и редактирования файлов локалей. Если список локалей изменится, обновите скрипт.
`push` и `publish` с настроенным адресом сервера не являются пробными запусками.

Когда удалённая доставка будет готова, скопируйте полную команду входа и URL
публикации из этой панели настройки. Эти команды запускают CLI и скрипты
примера из корня монорепозитория:

```bash
pnpm --filter @lingva/example-next-starter exec lingva auth login
# Stage: pnpm --filter @lingva/example-next-starter exec lingva auth login --platform-url https://stage.lingva.dev
export LINGVA_PUBLISH_API_URL="<copy publish URL from Lingva>"
pnpm --filter @lingva/example-next-starter lingva:push
```

CLI не загружает `.env.local` автоматически: экспортируйте URL публикации,
как показано выше, или передайте его через `--api-url`. Для обновления файлов
локалей примера выполните
`pnpm --filter @lingva/example-next-starter exec lingva pull --api-url "$LINGVA_PUBLISH_API_URL"`.
В пользовательском приложении вызывайте `pnpm lingva push` или `pnpm lingva pull`
напрямую с конфигурацией этого приложения и URL публикации; имена скриптов примера
не являются встроенными командами CLI.

После публикации проверьте текущий набор переводов локали через URL доставки
окружения с помощью сгенерированного SDK-ключа с правами чтения. Сама публикация
не переключает пример с локальной доставки: настройте его режим удалённой доставки
и URL набора переводов отдельно.

Сгенерированный SDK-ключ с правом `delivery:read` можно использовать в браузерной
среде выполнения. Храните учётные данные редактирования, публикации,
администрирования и сервисов на сервере; не раскрывайте их через переменные `NEXT_PUBLIC_*`.
