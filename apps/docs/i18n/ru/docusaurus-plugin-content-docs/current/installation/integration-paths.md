---
sidebar_position: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Варианты интеграции

Lingva можно внедрять постепенно. Выберите вариант в зависимости от того,
какие возможности платформы нужны вам на первом этапе.

## Вариант 1: Только локальный SDK {#path-1-local-sdk-only}

Используйте этот вариант, если хотите типизированные переводы в приложении без
создания учётной записи Lingva и доставки с платформы.

### 1. Установка пакетов {#1-install-packages}

<Tabs groupId="package-manager">
  <TabItem value="pnpm" label="pnpm" default>

```bash
pnpm add @lingva/js
pnpm add -D --allow-build=@lingva/cli @lingva/cli
```

  </TabItem>
  <TabItem value="yarn" label="yarn">

```bash
yarn add @lingva/js
yarn add -D @lingva/cli
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm install @lingva/js
npm install --save-dev @lingva/cli
```

  </TabItem>
</Tabs>

### 2. Инициализация Lingva {#2-initialize-lingva}

```bash
pnpm lingva init --mode local --no-auth --sdk vanilla
```

Ожидаемые файлы:

```text
lingva.config.yaml
.lingva/generated/runtime.ts
.lingva/translations/en.json
.lingva/generated/project.ts
```

### 3. Изменение локали по умолчанию {#3-edit-default-locale}

Сначала измените файл локали по умолчанию:

```text
.lingva/translations/en.json
```

Поддерживаются и вложенные объекты, и ключи с путями через точки:

```json
{
  "common": {
    "welcome": "Welcome, {name}."
  }
}
```

### 4. Синхронизация и проверка {#4-sync-and-check}

```bash
pnpm lingva sync
pnpm lingva check
```

`sync` добавляет недостающие ключи в остальные локали, не перезаписывая
существующие переводы. `check` подходит для CI и завершается с ошибкой при
расхождении контрактов локалей.

### 5. Использование среды выполнения {#5-use-runtime}

```ts
import { createLingvaJsRuntime } from '@lingva/js';
import lingvaConfig from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

const lingva = createLingvaJsRuntime({
  ...lingvaConfig,
  project,
});

console.log(
  lingva.tSync('common.welcome', {
    variables: { name: 'Nino' },
  })
);
```

## Вариант 2: Приложение React или Next.js {#path-2-react-or-nextjs-app}

Используйте этот вариант, если нужны провайдер, хуки, переключение локали и
необязательные интерфейсы редактирования прямо в приложении.

### React {#react}

```bash
pnpm add @lingva/react
pnpm add --save-dev --allow-build=@lingva/cli @lingva/cli
pnpm lingva init --mode local --no-auth --sdk react
pnpm lingva check
```

Подключите сгенерированный провайдер один раз:

```tsx
import { AppLingvaProvider } from './src/lingva/provider';

export function App() {
  return (
    <AppLingvaProvider>
      <YourRoutes />
    </AppLingvaProvider>
  );
}
```

Используйте переводы:

```tsx
import { LingvaText, useTranslation } from '@lingva/react';

export function Hero() {
  const { t } = useTranslation();

  return (
    <section>
      <h1>
        <LingvaText keyName="home.title" />
      </h1>
      <p>{t('home.subtitle')}</p>
    </section>
  );
}
```

### Next.js с App Router {#nextjs-app-router}

```bash
pnpm add @lingva/react @lingva/next
pnpm add --save-dev --allow-build=@lingva/cli @lingva/cli
pnpm lingva init --mode local --no-auth --sdk next
pnpm lingva check
```

Добавляйте транспиляцию зависимостей только если она требуется вашей настройке
сборки Next.js:

```js
// next.config.js
const nextConfig = {
  transpilePackages: ['@lingva/core', '@lingva/react', '@lingva/next'],
};

module.exports = nextConfig;
```

Подключите сгенерированный провайдер в `app/layout.tsx`:

```tsx
import { AppLingvaProvider } from '../src/lingva/provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppLingvaProvider>{children}</AppLingvaProvider>
      </body>
    </html>
  );
}
```

## Вариант 3: Локальная работа над переводами с проверкой {#path-3-local-authoring-with-review}

Используйте этот вариант, если переводчикам или продуктовой команде нужен более
безопасный локальный процесс до подключения доставки с платформы.

Рекомендуемые команды:

```bash
pnpm lingva metadata --output .lingva/metadata.json
pnpm lingva studio --output .lingva/studio.html
pnpm lingva sync
pnpm lingva check
```

Добавьте проверки CI:

```bash
pnpm lingva init --mode local --no-auth --ci github
```

Будет создан рабочий процесс GitHub Actions, который выполняет `lingva check`
для проверки расхождений локалей и валидации в pull request. Настройте
`metadataFile` и добавьте явный шаг `lingva metadata --check`, если проверка
структуры метаданных также обязательна. В существующих проектах добавьте рабочий
процесс вручную: `init` отказывается работать с существующей конфигурацией без
`--force`, а этот параметр заменяет начальные файлы проекта.

## Вариант 4: Удалённая доставка с платформы {#path-4-hosted-remote-delivery}

Используйте этот вариант, если опубликованные пакеты переводов должны храниться
в Lingva как в основном источнике данных вместо поставки файлов локалей вместе
с репозиторием приложения.

### 1. Создание проекта {#1-create-a-project}

Откройте приложение Lingva и создайте клиентский проект в `/app/projects`.

Адрес страницы проекта — `/app/projects/<project-id>`. Откройте там раздел
**Consumer application setup**; он содержит значения и команды для копирования,
которые используются ниже.

Запишите:

- идентификатор проекта
- локаль по умолчанию
- целевые локали
- окружение, обычно `dev`, `stage` или `prod`

### 2. Создание SDK-ключа {#2-create-an-sdk-key}

В панели настройки проекта создайте SDK-ключ, ограниченный этим проектом.
Созданные клиентом ключи имеют только разрешение `delivery:read`: они
идентифицируют запросы браузерной среды выполнения и позволяют управлять квотами
и отзывом ключей, но не позволяют редактировать, публиковать или администрировать
проект. Скопируйте показанный ключ и поместите его в окружение выполнения
клиентского приложения.

Не помещайте учётные данные для редактирования, публикации, администрирования
или другие ключи с правом записи в переменные `NEXT_PUBLIC_*`. Для публикации
человеком используйте вход CLI через браузер, а для CI — отдельные учётные данные
автоматизации, доступные только серверу.

### 3. Инициализация или обновление локальной конфигурации {#3-initialize-or-update-local-config}

```bash
pnpm lingva init --mode remote \
  --sdk vanilla \
  --project-id "<project-id>" \
  --api-url "<publish URL from Consumer application setup>" \
  --bundle-url "<bundle URL from Consumer application setup>"
```

Удалённая конфигурация должна оставлять закрытые значения вне браузерных сборок:

```ts
import { defineLingvaConfig } from '@lingva/core';

export default defineLingvaConfig({
  projectId: 'website',
  environment: 'dev',
  locale: 'en',
  fallbackLocale: 'en',
  apiKey: process.env.NEXT_PUBLIC_LINGVA_API_KEY,
  delivery: {
    mode: 'cdn',
    url: process.env.NEXT_PUBLIC_LINGVA_BUNDLE_URL_TEMPLATE,
  },
});
```

### 4. Аутентификация CLI {#4-authenticate-cli}

Для людей предпочтителен вход через браузер. Скопируйте полную команду из
**Consumer application setup**; адрес издателя и идентификатор клиента —
публичные метаданные OAuth, а не секреты:

```bash
pnpm lingva auth login
```

Используйте служебные токены только в CI или серверных обработчиках.

Выполните вход **до** удалённой инициализации на шаге 3. Чтобы перенести
существующий локальный проект, измените адрес и окружение в YAML, а также
настройки доставки сгенерированной среды выполнения; не запускайте init поверх
существующих файлов, не изучив последствия `--force`. Блок TypeScript выше
показывает поля среды выполнения, а не вторую корневую конфигурацию.
Используйте синтаксис переменных окружения своего сборщика; Vite использует
`import.meta.env.VITE_*`, а не `process.env.NEXT_PUBLIC_*`.

### 5. Отправка переводов {#5-push-translations}

```bash
pnpm lingva check
pnpm lingva push \
  --api-url "<publish URL from Lingva>" \
  --invalidate
```

CLI хранит сеанс пользователя в `~/.lingva/credentials.json`. Он не загружает
`.env` или `.env.local` автоматически; передавайте сформированные значения явно,
как показано выше, или экспортируйте их в оболочке перед запуском скрипта пакета.

### Источник каждого значения для платформы {#where-each-hosted-value-comes-from}

| Значение                                   | Где клиент получает его                                                          | Доступность                                 |
| ------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------- |
| Идентификатор проекта                      | Адрес и заголовок проекта в `/app/projects/<project-id>`                         | Публичная конфигурация                      |
| Окружение                                  | Раздел проекта **Environments**; начните с `dev`                                 | Публичная конфигурация                      |
| Адрес пакета переводов                     | **Consumer application setup** для выбранного окружения                          | Публичный адрес только для чтения           |
| SDK-ключ                                   | **Create SDK key**; показан один раз, разрешение `delivery:read`                 | Конфигурация браузерной среды выполнения    |
| Адрес API публикации                       | Сформированная конфигурация и команда push в **Consumer application setup**      | Конфигурация сервера/CLI; не учётные данные |
| Адрес издателя CLI и идентификатор клиента | Сформированная команда входа в **Consumer application setup**                    | Публичные метаданные OAuth                  |
| Учётные данные пользователя CLI            | Создаются входом через браузер и сохраняются в `~/.lingva/credentials.json`      | Локальные закрытые учётные данные           |
| Учётные данные публикации CI               | Предоставляются отдельно оператором Lingva и сохраняются в хранилище секретов CI | Секрет только для сервера                   |

Выполните `pnpm lingva pull`, чтобы обновить файлы локалей репозитория из текущих
пакетов на платформе. После push проверьте опубликованную локаль по
сформированному адресу пакета переводов с SDK-ключом только для чтения.

Для локального просмотра выходных файлов перед изменением данных на платформе:

```bash
pnpm lingva manifest --output .lingva/artifacts/plan/manifest.json
pnpm lingva bundle --locale en --output .lingva/artifacts/plan/en.bundle.json
```

Повторите `bundle` для каждой локали. Эти команды никогда не публикуют данные.
`publish` отправляет их, если настроен адрес сервиса; `--output-dir` не
превращает команду в пробный запуск.

### 6. Получение пакета переводов с платформы {#6-consume-hosted-bundle}

Браузерные приложения могут использовать SDK-ключ только для чтения или получать
пакеты переводов через серверный прокси с аутентификацией. Оставляйте ключи
администрирования проекта, редактирования и публикации на сервере.

Пример среды выполнения (приложение должно предоставить прокси доставки с
аутентификацией):

```ts
import { createLingvaJsRuntime } from '@lingva/js';

export const lingva = createLingvaJsRuntime({
  mode: 'remote',
  projectId: 'website',
  locale: 'en',
  fallbackLocale: 'en',
  apiUrl: '/api/lingva/delivery',
});
```

## Выбор подходящего варианта {#choosing-the-right-path}

| Потребность                                  | Рекомендуемый вариант          |
| -------------------------------------------- | ------------------------------ |
| Быстро добавить типизированные переводы      | Только локальный SDK           |
| Приложение React/Next с провайдером и хуками | Приложение React или Next.js   |
| Удобная переводчикам локальная проверка      | Локальная работа с проверкой   |
| Lingva как основной источник данных          | Удалённая доставка с платформы |

## Обязательные проверки перед выпуском {#required-verification-before-shipping}

Для локального режима:

```bash
pnpm lingva check
```

Для приложений React/Next:

```bash
pnpm lingva check
pnpm typecheck
pnpm build
```

Для режима платформы:

```bash
pnpm lingva check
pnpm lingva push \
  --api-url "<publish URL from Lingva>" \
  --invalidate
curl --fail --header "Authorization: Bearer $LINGVA_SDK_KEY" \
  "<bundle URL from Lingva with {locale} replaced>"
```

`lingva pull` скачивает пакеты переводов с платформы и записывает только
значения, созданные в каждой запрошенной локали; вычисленные резервные значения
не копируются в эту локаль. Команда требует заголовок ответа
`x-lingva-revision` и выполняет трёхстороннее слияние перед записью любой из
выбранных локалей. После первой настройки каждого окружения всё равно проверьте
развёрнутый адрес пакета переводов только для чтения. Если какая-либо команда
завершилась ошибкой, не считайте интеграцию завершённой.
