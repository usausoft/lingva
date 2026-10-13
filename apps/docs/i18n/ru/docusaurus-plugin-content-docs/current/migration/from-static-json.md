---
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Переход со статических JSON-файлов

При этом переходе переносимый `lingva.config.yaml` управляет CLI, а
`.lingva/generated/runtime.ts` служит его адаптером среды выполнения JavaScript.
Python и CI используют тот же YAML с командами `lingva sync`, `check`, `pull`
и `push`. Существующие написанные вручную конфигурации TS остаются поддержаны
адаптером npm; не дублируйте эквивалентные корневые файлы YAML и TS.

Это руководство описывает переход существующего проекта с переводами в обычных
JSON-файлах на типизированный процесс Lingva с версиями. Переход состоит из двух
этапов: **локального** (файлы переводов остаются в репозитории; проверьте
совместимость поведения среды выполнения) и **платформенного** (пакеты переводов
публикуются и доставляются во время выполнения; для обновления переводов не
требуется повторное развёртывание). Можно остановиться после этапа 1 — локальный
режим является полноценным решением.

---

## Что меняется и что остаётся прежним {#what-changes-and-what-stays-the-same}

|                                  | Процесс со статическими JSON        | Локальный режим Lingva                                                               | Режим платформы Lingva                        |
| -------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| Файлы переводов                  | `public/locales/en.json`            | `.lingva/translations/en.json`                                                       | То же + отправка в Lingva                     |
| Поиск ключей                     | Нетипизированные строки             | Типизация TypeScript, автодополнение                                                 | То же                                         |
| Обнаружение отсутствующих ключей | Во время выполнения или никогда     | При компиляции для типизированных API ключей; `lingva check` для расхождений локалей | То же                                         |
| Переключение локали              | Ручное состояние + повторный рендер | `setLocale()` или провайдер                                                          | То же                                         |
| Обновление доставки              | Повторное развёртывание             | Повторное развёртывание                                                              | `lingva push --invalidate`, без развёртывания |
| Проверка CI                      | Нет или собственная                 | `lingva check` + `lingva metadata --check`                                           | То же                                         |

---

## Этап 1: Локальный переход {#phase-1-local-migration}

Файлы переводов остаются в репозитории. Проверьте разделители пространств имён,
синтаксис подстановок, резервную локаль и обработку множественного числа и
форматированного текста перед заменой функции поиска. Lingva не воспроизводит
все возможности i18next/ICU.

### Шаг 1. Установка Lingva {#step-1-install-lingva}

<Tabs groupId="package-manager">
  <TabItem value="pnpm" label="pnpm" default>

```bash
pnpm add @lingva/js           # plain JS / non-React apps
# or
pnpm add @lingva/react        # React apps
# or
pnpm add @lingva/next         # Next.js apps

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

### Шаг 2. Создание начальных файлов Lingva {#step-2-scaffold-lingva}

```bash
pnpm lingva init --mode local --no-auth --sdk vanilla --locale en,fr --default-locale en
```

Будут созданы:

```text
lingva.config.yaml            ← portable CLI config
.lingva/generated/runtime.ts ← typed runtime config adapter
.lingva/translations/en.json  ← starter translation file
.lingva/generated/project.ts  ← module importing locale JSON
```

### Шаг 3. Перенос существующих JSON-файлов {#step-3-move-your-existing-json-files}

Скопируйте существующие файлы переводов в `.lingva/translations/`. Lingva
ожидает один файл на локаль с именем `{locale}.json`:

```bash
# Example: copying from a common static structure
cp public/locales/en/translation.json .lingva/translations/en.json
cp public/locales/fr/translation.json .lingva/translations/fr.json
```

По умолчанию Lingva использует вложенные ключи JSON:

```json
{
  "nav": {
    "home": "Home",
    "about": "About"
  },
  "auth": {
    "signIn": "Sign in"
  }
}
```

Плоские ключи тоже поддерживаются. Сохраните текущую структуру файлов — Lingva
требует только её согласованности между локалями.

### Шаг 4. Проверка `lingva.config.yaml` {#step-4-check-lingvaconfigyaml}

Укажите свои локали в Lingva:

```yaml
projectId: my-app
environment: dev
locales: [en, fr]
defaultLocale: en
fallbackLocale: en
translationFiles: .lingva/translations/{locale}.json
metadataFile: .lingva/metadata.json
```

Сгенерированный модуль проекта импортирует файлы локалей, выбранных при init.
Если позднее вы добавите локали, обновите и YAML, и импорты сгенерированной среды
выполнения и проекта. Не запускайте `init --force`, не проверив заменяемые файлы.

### Шаг 5. Проверка и генерация типов {#step-5-check-and-generate-types}

```bash
pnpm lingva check
pnpm lingva metadata --output .lingva/metadata.json
pnpm lingva types --output src/generated/lingva-types.ts
```

`check` проверяет структуру локалей, контракты переводов и метаданные рабочего
процесса. `types` создаёт типы TypeScript для ключей, локалей и переменных, а не
модуль проекта для среды выполнения. Сгенерированный модуль проекта импортирует
JSON, поэтому обычные изменения переводов не требуют повторной генерации.
Изучите результаты проверки перед удалением старой среды выполнения.

### Шаг 6. Замена среды выполнения {#step-6-replace-runtime-usage}

<Tabs groupId="framework">
  <TabItem value="js" label="Обычный JS / без привязки к фреймворку" default>

Замените места загрузки JSON и поиска значений:

```ts
// Before
import en from './locales/en.json';
const t = (key: string) => en[key] ?? key;

// After
import { createLingvaJsRuntime } from '@lingva/js';
import lingvaConfig from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

const lingva = createLingvaJsRuntime({ ...lingvaConfig, project });

// Typed — TypeScript will error if 'nav.home' does not exist
lingva.tSync('nav.home');
```

  </TabItem>
  <TabItem value="react" label="React">

Замените существующий провайдер и хук `useTranslation`:

```tsx
// Before (e.g. react-i18next)
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();

// After
import { useTranslation } from '@lingva/react';
const { t } = useTranslation();
```

Оберните приложение в `LingvaProvider` один раз:

```tsx
import { LingvaProvider } from '@lingva/react';
import lingvaConfig from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

export function App() {
  return (
    <LingvaProvider config={{ ...lingvaConfig, project }}>
      <YourApp />
    </LingvaProvider>
  );
}
```

Выберите `--sdk react` на шаге 2, чтобы создать обёртку провайдера. В
существующем проекте добавьте провайдер вручную вместо замены файлов повторным
init:

```bash
pnpm lingva init --mode local --no-auth --sdk react --locale en,fr
```

  </TabItem>
  <TabItem value="next" label="Next.js">

```tsx
// Before (e.g. next-i18next, next-intl)
import { useTranslations } from 'next-intl';
const t = useTranslations('nav');

// After
import { useTranslation } from '@lingva/react';
const { t } = useTranslation();
t('nav.home'); // key includes the namespace prefix
```

Выберите провайдер App Router при первоначальном создании файлов:

```bash
pnpm lingva init --mode local --no-auth --sdk next --locale en,fr
```

Будет создан `src/lingva/provider.tsx` с готовым `AppLingvaProvider`.
Оберните корневой `layout.tsx`:

```tsx
import { AppLingvaProvider } from '@/lingva/provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <AppLingvaProvider>{children}</AppLingvaProvider>
      </body>
    </html>
  );
}
```

  </TabItem>
</Tabs>

### Шаг 7. Добавление проверки CI (необязательно, но рекомендуется) {#step-7-add-a-ci-check-optional-but-recommended}

```bash
pnpm lingva init --mode local --no-auth --sdk vanilla --locale en,fr --ci github
```

Добавьте `--ci github` к исходной команде init или вручную добавьте
сгенерированный рабочий процесс в существующий проект. Init не принимает
существующую конфигурацию без `--force`. Рабочий процесс устанавливает
самостоятельный исполняемый файл и выполняет `lingva check` без изменения
файлов. Метаданными также управляет Rust: добавьте `lingva metadata --check`,
если расхождение структуры метаданных должно приводить к ошибке CI.

### Шаг 8. Удаление старой библиотеки {#step-8-remove-the-old-library}

Когда приложение собирается и тесты проходят со средой выполнения Lingva,
удалите предыдущую библиотеку интернационализации:

```bash
pnpm remove react-i18next i18next    # or next-i18next, next-intl, etc.
```

---

## Соответствие понятий {#concept-mapping}

| Старое понятие                                  | Эквивалент Lingva                                                                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Пространство имён (`common`, `auth`)            | Префикс ключа (`common.`, `auth.`)                                                                                          |
| `t('auth:signIn')`                              | `t('auth.signIn')`                                                                                                          |
| `t('greeting', { name })`                       | `t('greeting', { variables: { name } })`                                                                                    |
| `changeLanguage('fr')`                          | `setLocale('fr')`                                                                                                           |
| `i18n.language`                                 | `locale` из `useTranslation()`                                                                                              |
| `fallbackLng`                                   | `fallbackLocale` в переносимой конфигурации и адаптере среды выполнения                                                     |
| Суффиксы множественного числа `_one` / `_other` | Нет автоматического выбора по суффиксу; выбирайте ключи/варианты явно или перейдите на сообщения JS/TS `plural` в стиле ICU |
| Отсутствующий ключ → возвращается строка ключа  | Отсутствующий ключ → поиск в `fallbackLocale`, затем строка ключа                                                           |
| Компонент `Trans` для подстановок JSX           | Используйте `t()` + разбиение по `{placeholder}` или передайте функцию рендеринга                                           |

---

## Этап 2: Доставка с платформы (необязательно) {#phase-2-hosted-delivery-optional}

После стабилизации этапа 1 можно переключиться на доставку с платформы. Она
позволяет отправлять обновления переводов без повторного развёртывания приложения.

### 1. Создание учётной записи и проекта Lingva {#1-create-a-lingva-account-and-project}

Откройте `/app/projects/<project-id>` и найдите **Consumer application setup**.
Скопируйте показанную там команду входа через браузер. CLI получает публичные
метаданные OAuth выбранного окружения из платформы:

```bash
pnpm lingva auth login
# Stage: pnpm lingva auth login --platform-url https://stage.lingva.dev
```

SDK-ключ, созданный в клиентском интерфейсе, — конфигурация среды выполнения
только для чтения. Он не заменяет вход пользователя для публикации.

### 2. Отправка переводов в Lingva {#2-push-translations-to-lingva}

```bash
pnpm lingva push \
  --api-url "<copy publish URL from Lingva>" \
  --invalidate
```

### 3. Переключение режима доставки {#3-switch-delivery-mode}

Обновите конфигурацию доставки сгенерированного адаптера среды выполнения.
Сохраните существующие поля идентификации проекта и локалей и укажите то же
окружение, что используется при push из CLI:

```ts
import { defineLingvaConfig } from '@lingva/core';

const env = typeof process !== 'undefined' ? process.env : {};

export default defineLingvaConfig({
  projectId: 'my-app',
  environment: 'dev',
  locales: ['en', 'fr'],
  defaultLocale: 'en',
  locale: 'en',
  fallbackLocale: 'en',
  apiKey: env.NEXT_PUBLIC_LINGVA_API_KEY,
  translationFiles: '.lingva/translations/{locale}.json',
  generatedProjectFile: '.lingva/generated/project.ts',
  delivery: {
    mode: 'cdn',
    url: env.NEXT_PUBLIC_LINGVA_BUNDLE_URL ?? '',
  },
});
```

Задайте адрес пакета переводов и SDK-ключ с разрешением `delivery:read` из
**Consumer application setup** на `/app/projects/<project-id>`. Используйте
правила публичных переменных окружения своего сборщика (`NEXT_PUBLIC_*` в
Next.js, `import.meta.env.VITE_*` в Vite). Никогда не раскрывайте учётные данные
для записи или администрирования. `apiUrl` в YAML выбирает сервис передачи для
CLI; конфигурация доставки среды выполнения определяет загрузку браузером.
Используйте одно и то же окружение для обоих.

### 4. Публикация и сброс кеша {#4-publish-and-invalidate}

```bash
pnpm lingva push \
  --api-url "<copy publish URL from Lingva>" \
  --invalidate
```

Опубликованные изменения переводов не требуют повторного развёртывания
приложения. Уже работающие клиенты увидят их, когда настроенный кеш доставки
перезагрузится или приложение явно обновит клиент; `push --invalidate` сам по
себе не обновляет клиент, уже загруженный в памяти.

---

## Откат {#rollback}

Если нужно вернуться к старой библиотеке до этапа 2:

1. Отмените изменения импортов Lingva через `git revert`.
2. Переустановите старую библиотеку.
3. Удалите переносимую конфигурацию, импорты сгенерированной среды выполнения и шаги CLI в CI только после восстановления старой интеграции.

В локальном режиме нет серверного состояния, которое нужно отменять.

---

## Дальнейшие шаги {#next-steps}

- [Справочник конфигурации](/installation/configuration)
- [Варианты интеграции](/installation/integration-paths)
- [Начальный проект Next.js](/installation/next-starter)
- [Начальный проект React с платформой](/installation/hosted-react-starter)
