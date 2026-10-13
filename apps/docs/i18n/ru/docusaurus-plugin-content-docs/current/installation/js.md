---
sidebar_position: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# JavaScript

Используйте `@lingva/js`, когда Lingva нужна вне React: в обычном браузерном коде,
вспомогательных функциях для CLI, скриптах сборки или конфигурации сайта, например Docusaurus.

## Начало работы {#get-started}

### 1. Установите пакет {#1-install-the-package}

<Tabs groupId="package-manager">
  <TabItem value="pnpm" label="pnpm" default>

```bash
pnpm add @lingva/js @lingva/core
pnpm add --save-dev --allow-build=@lingva/cli @lingva/cli
```

  </TabItem>
  <TabItem value="yarn" label="yarn">

```bash
yarn add @lingva/js @lingva/core
yarn add --dev @lingva/cli
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm install @lingva/js @lingva/core
npm install --save-dev @lingva/cli
```

  </TabItem>
</Tabs>

`@lingva/cli` — только адаптер установки для JavaScript-проектов. Его исполняемый
файл `lingva` запускает тот же самостоятельный движок на Rust, который используется
при прямой установке и установке через Cargo или PyPI. Если соответствующий бинарный
файл с проверяемой контрольной суммой нельзя установить, установка пакета завершается
понятной ошибкой. Пользовательские команды никогда не переключаются на вторую реализацию на JavaScript.

### 2. Определите ресурсы проекта {#2-define-project-resources}

```ts
import { createLingvaResources, defineLingvaProject } from '@lingva/core';

export const resources = createLingvaResources({
  en: {
    welcome: {
      title: 'Welcome to Lingva',
      message: 'Hello, {name}!',
    },
  },
  de: {
    welcome: {
      title: 'Willkommen bei Lingva',
    },
  },
});

export const project = defineLingvaProject({
  projectId: 'website',
  resources,
  defaultLocale: 'en',
  fallbackLocale: 'en',
});
```

### 3. Создайте среду выполнения JavaScript {#3-create-a-javascript-runtime}

```ts
import { createLingvaJsRuntime } from '@lingva/js';

export const lingva = createLingvaJsRuntime({
  project,
  locale: 'en',
});
```

Эту же среду выполнения можно создать через высокоуровневую настройку удалённой доставки:

```ts
import { createLingvaJsRuntime } from '@lingva/js';

export const lingva = createLingvaJsRuntime({
  mode: 'remote',
  apiUrl: process.env.LINGVA_PUBLISH_API_URL,
  apiKey: process.env.LINGVA_API_KEY,
  projectId: 'website',
  locale: 'en',
  fallbackLocale: 'en',
});
```

Скопируйте `LINGVA_PUBLISH_API_URL` из целевого окружения на странице настройки проекта.
Lingva использует отдельный адрес размещённого сервиса для каждого развёрнутого окружения
платформы; общего имени хоста API, которое можно угадать, нет. Для браузерного кода
используйте SDK-ключ с правом `delivery:read` со страницы настройки и принятый в вашем
фреймворке способ задания публичных переменных окружения на этапе сборки. Никогда не
включайте ключ с правами записи или администрирования в клиентскую сборку.

### 4. Переводите строки {#4-translate-strings}

```ts
lingva.tSync('welcome.title');
lingva.tSync('welcome.message', {
  variables: { name: 'Lingva' },
});

lingva.setLocale('de');
lingva.tSync('welcome.title');
```

Этот синхронный пример использует локальный `project`. При удалённой доставке нужно
загрузить локаль до синхронного получения переводов: сам по себе `setLocale` ничего не загружает.

```ts
await lingva.loadLocale('en');
console.log(lingva.tSync('welcome.title'));
await lingva.loadLocale('de');
console.log(lingva.tSync('welcome.title'));
```

Подпишитесь через `lingva.subscribe(listener)` и сохраните возвращённую функцию отписки.
Когда представление или запрос, владеющие средой выполнения, завершаются, отпишитесь
и вызовите `lingva.destroy()`. Метод `preload(keys, locale, { signal })` принимает
`AbortSignal` вызывающего кода. Метод `loadLocale(locale)` выбирает локаль, самостоятельно
управляет отменой и прерывает предыдущую загрузку локали. Его ошибки появляются в
`getSnapshot()` и уведомлениях подписчиков, а возвращённый promise отклоняется.
Ошибки `preload` отклоняют его promise, но не обновляют этот снимок состояния загрузки
и ошибки. Подробнее о доставке и отмене см. в [справочнике конфигурации](./configuration.md).

## Расширенное использование {#advanced}

`@lingva/js` также подходит для интерфейсов, формируемых из конфигурации.

```ts
import { createLingvaJsRuntime } from '@lingva/js';

const runtime = createLingvaJsRuntime({
  project,
  locale: 'en',
});

export const siteText = {
  title: runtime.tSync('welcome.title'),
  locale: runtime.getLocale(),
  locales: runtime.getAvailableLocales(),
};
```

Lingva поддерживает как плоские ключи вроде `'welcome.title'`, так и вложенные объекты
ресурсов вроде `welcome: { title: '...' }`. Во время выполнения оба варианта разрешаются
по одному контракту ключей с путями, разделёнными точками.

Публичная документация использует тот же подход для локализованных текстов сайта.

Чтобы не писать начальную конфигурацию вручную, начните с команды:

```bash
pnpm lingva init --mode local --no-auth --sdk vanilla
```
