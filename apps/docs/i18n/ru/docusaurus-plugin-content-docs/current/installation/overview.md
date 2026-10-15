---
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Обзор установки

Начните с **Remote** — рекомендуемого режима Lingva. Создайте учётную запись и проект в рабочем пространстве, подключите SDK и доставляйте опубликованные переводы в приложение. Используйте **Local** только для автономной доставки или ресурсов, которые должны оставаться в репозитории.

В разделе **[Варианты интеграции](/installation/integration-paths)** приведены полные шаги Remote и запасные локальные варианты.

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

## Подключите Remote {#connect-remote}

После создания проекта войдите в CLI и выберите **один** SDK для приложения:

```bash
lingva auth login
lingva init --mode remote --sdk vanilla
lingva check
```

Замените `vanilla` на `react`, `next`, `angular`, `vue`, `svelte` или `python`. Установите соответствующий пакет среды выполнения перед использованием адаптера. Для Python используйте `lingva-sdk[http]`; для JavaScript — пакет `@lingva/<framework>`.

Вход получает метаданные OAuth из `https://lingva.dev`; для другого окружения используйте `--platform-url`. Init по умолчанию использует Remote, обнаруживает доступные проекты и предлагает выбор, если их несколько.

Каждый SDK создаёт переносимый `lingva.config.yaml` и файлы переводов. Варианты JavaScript также создают `.lingva/generated/runtime.ts` и адаптер фреймворка, например `src/lingva/provider.tsx` для React/Next. Удалённая настройка не создаёт локальный `.lingva/generated/project.ts`.

Откройте `/app/projects/<project-id>` → **Consumer application setup**. Проверьте окружение, адреса публикации и пакетов, создайте SDK-ключ с правом `delivery:read` и настройте его в адаптере среды выполнения. Используйте синтаксис переменных окружения вашего сборщика. Учётные данные публикации должны оставаться только в CLI или на сервере.

Подготовьте переводы в `.lingva/translations/{locale}.json`, затем проверьте и опубликуйте их:

```bash
lingva check
lingva push --invalidate
```

Push использует адрес публикации из конфигурации. Если его нужно задать явно, скопируйте URL из панели настройки и передайте `--api-url`. Проверьте загрузку опубликованной локали приложением с SDK-ключом только для чтения.

Чтобы проверить начальные файлы до записи, выполните `lingva init --mode remote --sdk vanilla --dry-run --format text` в новом проекте. Для существующей конфигурации проверьте изменения вручную; не перезаписывайте рабочие файлы через `--force`.

## Запасной вариант: только Local {#local-only-fallback}

Используйте Local, если приложению нужна доставка из репозитория без учётной записи Lingva. Для нового проекта явно отключите Remote:

```bash
lingva init --mode local --no-auth --sdk vanilla
lingva sync
lingva check
```

Выберите свой SDK вместо `vanilla`. В локальном режиме JavaScript создаётся `.lingva/generated/project.ts` с импортами ресурсов. Этот файл используется только в локальных примерах; для Remote используйте сгенерированный адаптер без импорта локального проекта. Сохраните переводы и проверьте конфигурацию перед сменой режима.

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

## Рекомендуемый процесс {#recommended-flow}

1. Создайте проект Lingva, установите CLI и войдите.
2. Подключите Remote через `lingva init --mode remote --sdk <sdk>`.
3. Используйте `lingva.config.yaml` для CLI и сгенерированный адаптер для приложения.
4. Настройте SDK-ключ только для чтения и подготовьте переводы.
5. Выполните `lingva check`, затем `lingva push --invalidate`.
6. Проверьте доставку пакета в приложении и добавьте проверки типов и сборку приложения в CI.

Local остаётся запасным вариантом: `lingva check` проверяет ресурсы и контракты без публикации на платформе.

## Проверка {#verification}

```ts
import { createLingvaJsRuntime } from '@lingva/js';
import lingvaConfig from './.lingva/generated/runtime';

const lingva = createLingvaJsRuntime({
  ...lingvaConfig,
});

await lingva.loadLocale('en');

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
- [Начальный проект React с платформой](/installation/hosted-react-starter)
- [Начальный проект Next.js](/installation/next-starter)
- [Python](/installation/python)
- [Конфигурация](/installation/configuration)
- [Список реализованных возможностей](/progress)
