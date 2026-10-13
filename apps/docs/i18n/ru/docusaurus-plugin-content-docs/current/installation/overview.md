---
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Обзор установки

Настройка Lingva остаётся простой, если следовать такому порядку:

1. войдите один раз с помощью `lingva auth login`
2. создайте начальную конфигурацию для размещённой платформы командой `lingva init`
3. используйте `lingva.config.yaml` как переносимый контракт CLI; шаблоны для фреймворков создают типизированный адаптер среды выполнения в `.lingva/generated/runtime.ts`. Написанный вручную доверенный `lingva.config.ts` остаётся альтернативой только для npm.
4. используйте адаптер своего фреймворка или `@lingva/js` для кода, не зависящего от фреймворка

Если вы не уверены, какой вариант выбрать, начните с
**[Вариантов интеграции](/installation/integration-paths)**. Там отдельно описаны
локальный SDK, провайдер React/Next, локальная работа над переводами, доставка
с размещённой платформы и автономный эмулятор.

## Начало работы {#get-started}

Установите самостоятельный CLI один раз. Он содержит собственную среду
выполнения; Node.js и Python не требуются. В macOS/Linux используйте публичный
репозиторий Homebrew:

```bash
brew install usausoft/tap/lingva
lingva --version
```

Для полного набора клиентских команд нужна версия CLI **0.1.5** или новее.
Homebrew не устанавливает мост для среды выполнения и конфигурации JavaScript.
Различия и команды обновления описаны в [справочнике CLI](./cli.md).

Прямые установщики скачивают движок с проверкой контрольной суммы из публичного
канала двоичных файлов npm. Node.js и Python для этого не требуются:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://unpkg.com/@lingva/cli@latest/lingva-installer.sh | sh
```

Windows PowerShell:

```powershell
irm https://unpkg.com/@lingva/cli@latest/lingva-installer.ps1 | iex
```

Разработчики на Rust могут установить тот же исполняемый файл из crates.io.
Этот способ компилирует его локально и поэтому требует инструментарий Rust;
пользователям приложений лучше выбрать установщик готовых двоичных файлов выше:

```bash
cargo install lingva
```

Затем установите только пакет среды выполнения, который использует приложение:

<Tabs groupId="package-manager">
  <TabItem value="pnpm" label="pnpm" default>

```bash
pnpm add @lingva/js
```

  </TabItem>
  <TabItem value="yarn" label="yarn">

```bash
yarn add @lingva/js
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm install @lingva/js
```

  </TabItem>
</Tabs>

Для сервисов на Python установите опубликованную среду выполнения Python:

```bash
python -m pip install "lingva-sdk[http]"
```

В **[руководстве по Python](./python.md)** описаны локальная синхронизация,
получение и отправка переводов на платформу, автоматизация CI и загрузка пакетов
переводов во время выполнения.

Войдите и создайте начальные файлы проекта:

```bash
lingva auth login
lingva init
```

Вход получает адреса OAuth из `https://lingva.dev` (адрес можно изменить через
`--platform-url`). Init по умолчанию использует удалённый режим, находит доступные
проекты, автоматически выбирает единственный проект или предлагает выбор в
терминале, если проектов несколько.

Каждый вариант SDK создаёт переносимый `lingva.config.yaml`. Варианты JavaScript
также создают `.lingva/generated/runtime.ts` и адаптеры фреймворков. Python
использует только переносимые файлы:

```bash
lingva init --sdk python
```

Тот же исполняемый файл создаёт переносимую конфигурацию без Node.js и Python:

```bash
lingva auth login
lingva init --sdk python
```

Если вы начинаете приложение на React или Next.js, можно также создать первый
компонент-обёртку провайдера:

```bash
lingva init --sdk react
lingva init --sdk next
```

При этом создаётся `src/lingva/provider.tsx` с обёрткой провайдера для приложения.

Для Angular, Vue и Svelte также доступны начальные файлы с учётом фреймворка:

```bash
lingva init --sdk angular
lingva init --sdk vue
lingva init --sdk svelte
```

Интерактивная настройка поддерживает React, Next.js, Angular, Vue, Svelte,
JavaScript без привязки к фреймворку и Python. Swift, Kotlin и Flutter используют
тот же контракт пакетов переводов с платформы через предварительные версии SDK,
доступные в исходном коде; эти пакеты описаны в
[руководстве по нативным SDK](./native-bundles.md).

Чтобы сначала посмотреть, какие файлы будут созданы:

```bash
lingva init --dry-run --format text
```

`--dry-run` перечисляет все файлы конфигурации, локалей, сгенерированных адаптеров
и CI без записи на диск. Существующие сгенерированные файлы защищены от
перезаписи, если не передать `--force`.

Для полностью локального репозитория без учётной записи отключите подключение
явно:

```bash
lingva init --mode local --no-auth --sdk python
```

Чтобы создать полную локальную интеграцию React в существующем приложении:

```bash
pnpm add @lingva/react
lingva init --mode local --no-auth --sdk react
lingva check
```

Для публикации на платформе откройте `/app/projects/<project-id>` и скопируйте
команды входа и отправки из раздела **Consumer application setup**. Вход получает
публичные сведения об издателе OAuth и клиенте из выбранного адреса платформы.

Для приложения Next.js с App Router:

```bash
pnpm add @lingva/next
lingva init --mode local --no-auth --sdk next
lingva check
```

Публичный [пример с несколькими фреймворками](https://github.com/usausoft/lingva-demo)
показывает тот же контракт переводов в React, Angular, Vue, Svelte, обычном
JavaScript, Swift, Kotlin и Flutter. Используйте его как пример реализации;
команды выше — поддерживаемый способ настройки клиентского репозитория.

Минимальный пример среды выполнения:

```ts
import { createLingvaJsRuntime } from '@lingva/js';
import lingvaConfig from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

const lingva = createLingvaJsRuntime({
  ...lingvaConfig,
  project,
});

console.log(lingva.tSync('common.welcome'));
```

## Текущая модель пакетов {#current-package-model}

| Пакет                | Описание                                                                           | Когда использовать                                                       |
| -------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `@lingva/core`       | Типизированные примитивы проекта, среды выполнения, проверки, манифеста и доставки | Инструменты и расширенная настройка                                      |
| `@lingva/js`         | Обёртка среды выполнения без привязки к фреймворку                                 | Браузерные скрипты, интерфейсы на основе конфигурации, статические сайты |
| `@lingva/react`      | Провайдер и хуки для React                                                         | Приложения React и Next.js                                               |
| `@lingva/next`       | Тонкий адаптер над средой выполнения React                                         | Приложения Next.js, которым нужна отдельная точка входа фреймворка       |
| `@lingva/angular`    | Внедрение зависимостей, сигналы и SSR с изоляцией запросов                         | Angular-приложения на самостоятельных компонентах, модулях и с SSR       |
| `@lingva/vue`        | Плагин Vue, Composition API и SSR с изоляцией запросов                             | Приложения Vue 3 и Nuxt                                                  |
| `@lingva/svelte`     | Типизированные хранилища и серверные функции с изоляцией запросов                  | Приложения Svelte 5 и SvelteKit                                          |
| `@lingva/docusaurus` | Тонкий адаптер над средой выполнения JS                                            | Сайты Docusaurus и порталы документации                                  |
| `@lingva/electron`   | Тонкий адаптер над средой выполнения JS                                            | Скрипты preload и интерфейсы renderer в Electron                         |
| `lingva-sdk`         | Среда выполнения переводов Python (без CLI начиная с 0.1.5)                        | Серверные приложения, фоновые задачи и приложения Python                 |
| `lingva-cli`         | Отдельный установщик клиентского CLI на Rust (0.1.5)                               | Инструменты разработки Python и CI                                       |

## Рекомендуемый порядок {#recommended-flow}

1. Выполните `lingva init`
2. Выберите доставку `local` или `remote`
3. Храните переносимую конфигурацию CLI в `lingva.config.yaml`, а типизированную конфигурацию среды выполнения JavaScript — в `lingva.config.ts`
4. Выполните `lingva sync` для согласования JSON-файлов локалей; `types` создаёт отдельные файлы типов
5. Импортируйте скрытый сгенерированный модуль проекта вместо ручного подключения ресурсов локалей
6. Используйте `createLingvaJsRuntime()`, `LingvaProvider` или сгенерированный провайдер Next
7. Пусть компоненты и скрипты работают с переводами, а не с ручным подключением ресурсов

Для рабочего приложения каждый вариант должен завершаться воспроизводимой
проверкой:

- локальный режим из корня конфигурации: `lingva check`
- режим React/Next: проверка Lingva, а также `typecheck` и `build` приложения
- режим платформы: `lingva push --invalidate` и получение текущего пакета
  переводов из развёрнутого окружения приложения

## Проверка {#verification}

```ts
import { createLingvaJsRuntime } from '@lingva/js';
import lingvaConfig from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

const lingva = createLingvaJsRuntime({
  ...lingvaConfig,
  project,
});

const value = await lingva.t('test.key', {
  variables: { name: 'Lingva' },
});

console.log(value);
```

## Дальнейшие шаги {#next-steps}

- [Варианты интеграции](/installation/integration-paths)
- [JavaScript](/installation/js)
- [React](/installation/react)
- [Next.js](/installation/nextjs)
- [Начальный проект Next.js](/installation/next-starter)
- [Начальный проект React с платформой](/installation/hosted-react-starter)
- [Python](/installation/python)
- [Конфигурация](/installation/configuration)
- [Список реализованных возможностей](/progress)
