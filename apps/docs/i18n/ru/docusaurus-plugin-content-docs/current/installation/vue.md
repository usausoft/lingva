---
sidebar_position: 8
---

# Vue

`@lingva/vue` предоставляет плагин Vue и помощник Composition API на основе
типизированной среды выполнения Lingva.

## Remote: рекомендуемая настройка {#recommended-remote-setup}

Сначала создайте проект в Lingva. Установите SDK и CLI, войдите и выберите проект:

```bash
pnpm add @lingva/vue @lingva/core
pnpm add -D --allow-build=@lingva/cli @lingva/cli
pnpm lingva auth login
pnpm lingva init --mode remote --sdk vue
pnpm lingva check
```

Init создаёт `lingva.config.yaml` и `.lingva/generated/runtime.ts` для удалённой доставки. В разделе **Consumer application setup** проекта создайте SDK-ключ с правом `delivery:read` и настройте его в адаптере среды выполнения с учётом синтаксиса переменных окружения вашего сборщика. Учётные данные публикации должны оставаться только в CLI или на сервере.

Следуйте разделу [Remote в вариантах интеграции](/installation/integration-paths#path-4-hosted-remote-delivery), чтобы подготовить и опубликовать переводы, затем проверить загрузку пакетов приложением.

Подключите сгенерированный плагин `appLingva` из `src/lingva/index.ts` через `app.use(appLingva)`. Удалённая настройка не создаёт локальный `project.ts`, используемый в примерах запасного варианта ниже.

## Запасной вариант: только Local {#local-only-fallback}

Используйте примеры с локальными ресурсами ниже, только если нужна доставка из репозитория без учётной записи Lingva. Не запускайте init поверх существующей конфигурации: сохраните переводы и проверьте изменения перед сменой режима.

## Установка {#install}

```bash
pnpm add @lingva/vue @lingva/core
pnpm add -D --allow-build=@lingva/cli @lingva/cli
pnpm lingva init --mode local --no-auth --sdk vue
```

Команда создаёт `src/lingva/index.ts` с плагином `appLingva`.

## Подключение плагина {#install-the-plugin}

```ts
// src/main.ts
import { createApp } from 'vue';
import { createLingvaVue } from '@lingva/vue';
import lingvaConfig from '../.lingva/generated/runtime';
import project, { type resources } from '../.lingva/generated/project';
import App from './App.vue';

const lingva = createLingvaVue<typeof resources>({
  ...lingvaConfig,
  project,
});

createApp(App).use(lingva).mount('#app');
```

## Использование композиционной функции {#use-the-composable}

```vue
<script setup lang="ts">
import { useLingva } from '@lingva/vue';
import type { resources } from '../../.lingva/generated/project';

const { loading, locale, setLocale, t } = useLingva<typeof resources>();
</script>

<template>
  <h1>{{ t('welcome.title') }}</h1>
  <button @click="setLocale('ru')">Русский</button>
  <small v-if="loading">Loading translations…</small>
  <small>{{ locale }}</small>
</template>
```

`locale`, `loading` и `error` — реактивные ссылки Vue. Используйте `setLocale`,
а не прямое присваивание ссылки локали, чтобы запустить доставку.
Ключи перевода и их переменные остаются типизированными благодаря сгенерированному
проекту. Удалённая загрузка локалей автоматически подгружает наборы переводов
и отменяет устаревшие запросы. `setLocale` возвращает promise, который отклоняется
при ошибке доставки; обрабатывайте это отклонение и отображайте ссылку `error`.
Promise `ready` браузерного плагина завершается после начальной загрузки и
записывает ошибки в `error`, но не отклоняется. Вызывайте
`lingva.runtime.destroy()`, когда приложение, владеющее плагином, размонтируется.

Создавайте один плагин на приложение Vue. Микрофронтенды должны разделять
сгенерированный контракт переводов, а не изменяемый экземпляр плагина;
см. раздел [Микрофронтенды](./microfrontends.md).

## Nuxt и серверный рендеринг {#nuxt-and-server-rendering}

Для удалённой доставки при SSR используйте `createLingvaVueServer`. Фабрика
дожидается начального набора переводов локали и выбрасывает ошибку при неудачной
доставке, чтобы Nuxt обработал её до отправки частично переведённого HTML.

```ts
// plugins/lingva.ts
import { createLingvaVue, createLingvaVueServer } from '@lingva/vue';
import lingvaConfig from '../.lingva/generated/runtime';
import project from '../.lingva/generated/project';

export default defineNuxtPlugin(async (nuxtApp) => {
  const locale = 'en'; // Resolve this from the current request or user session.
  const lingva = import.meta.server
    ? await createLingvaVueServer({ ...lingvaConfig, project, locale })
    : createLingvaVue({ ...lingvaConfig, project, locale });

  nuxtApp.vueApp.use(lingva);
  if (import.meta.server) {
    nuxtApp.hook('app:rendered', () => lingva.runtime.destroy());
  }
});
```

Никогда не экспортируйте общий экземпляр серверного адаптера. Nuxt может
рендерить запросы параллельно, поэтому каждый запрос должен владеть своей
локалью, средой выполнения и жизненным циклом очистки.

Работающий пример реализации доступен в `examples/nuxt-starter`.
