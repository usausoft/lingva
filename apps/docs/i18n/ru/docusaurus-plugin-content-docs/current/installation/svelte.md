---
sidebar_position: 7
---

# Svelte

`@lingva/svelte` предоставляет локаль Lingva и состояния загрузки и ошибки
как хранилища Svelte, а также типизированные функции перевода и переключения локали.

## Remote: рекомендуемая настройка {#recommended-remote-setup}

Сначала создайте проект в Lingva. Установите SDK и CLI, войдите и выберите проект:

```bash
pnpm add @lingva/svelte @lingva/core
pnpm add -D --allow-build=@lingva/cli @lingva/cli
pnpm lingva auth login
pnpm lingva init --mode remote --sdk svelte
pnpm lingva check
```

Init создаёт `lingva.config.yaml` и `.lingva/generated/runtime.ts` для удалённой доставки. В разделе **Consumer application setup** проекта создайте SDK-ключ с правом `delivery:read` и настройте его в адаптере среды выполнения с учётом синтаксиса переменных окружения вашего сборщика. Учётные данные публикации должны оставаться только в CLI или на сервере.

Следуйте разделу [Remote в вариантах интеграции](/installation/integration-paths#path-4-hosted-remote-delivery), чтобы подготовить и опубликовать переводы, затем проверить загрузку пакетов приложением.

Используйте сгенерированные хранилища `appLingva` из `src/lib/lingva.ts` в браузерных компонентах. Удалённая настройка не создаёт локальный `project.ts`, используемый в примерах запасного варианта ниже. Создавайте отдельные экземпляры среды выполнения для серверных запросов.

## Запасной вариант: только Local {#local-only-fallback}

Используйте примеры с локальными ресурсами ниже, только если нужна доставка из репозитория без учётной записи Lingva. Не запускайте init поверх существующей конфигурации: сохраните переводы и проверьте изменения перед сменой режима.

## Установка {#install}

```bash
pnpm add @lingva/svelte @lingva/core
pnpm add -D --allow-build=@lingva/cli @lingva/cli
pnpm lingva init --mode local --no-auth --sdk svelte
```

Команда создаёт `src/lib/lingva.ts` с набором хранилищ `appLingva`.

## Создание хранилищ {#create-the-stores}

```ts
// src/lib/lingva.ts
import { createLingvaSvelte } from '@lingva/svelte';
import lingvaConfig from '../../.lingva/generated/runtime';
import project, { type resources } from '../../.lingva/generated/project';

export const lingva = createLingvaSvelte<typeof resources>({
  ...lingvaConfig,
  project,
});
```

## Использование в компоненте {#use-them-in-a-component}

```svelte
<script lang="ts">
  import { lingva } from '$lib/lingva';

  const { loading, locale, setLocale, t } = lingva;
</script>

<h1>{$t('welcome.title')}</h1>
<button onclick={() => setLocale('ru')}>Русский</button>
{#if $loading}<small>Loading translations…</small>{/if}
<small>{$locale}</small>
```

Каждый экземпляр адаптера владеет своей средой выполнения и хранилищами.
Этот подход подходит для приложений Svelte и клиентских модулей SvelteKit;
не размещайте изменяемый экземпляр с данными конкретного пользователя в общем
серверном модуле. Удалённые загрузки можно отменять; ошибки появляются в
хранилище `error`. `setLocale` возвращает promise, который отклоняется при ошибке
доставки: обрабатывайте отклонение и отображайте хранилище ошибок.
Promise `ready` браузерного адаптера завершается после начальной загрузки
и записывает ошибки в `error`, но не отклоняется. Уничтожайте среду выполнения,
когда приложение, владеющее адаптером, размонтируется.

## Серверный рендеринг SvelteKit {#sveltekit-server-rendering}

Создавайте среду выполнения внутри функции `load` текущего запроса.
Не возвращайте хранилища или функции среды выполнения как данные страницы:
переводите содержимое, принадлежащее серверу, и возвращайте только сериализуемые значения.

```ts
// src/routes/+layout.server.ts
import { get } from 'svelte/store';
import { createLingvaSvelteServer } from '@lingva/svelte';
import lingvaConfig from '../../.lingva/generated/runtime';
import project from '../../.lingva/generated/project';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const locale = locals.locale ?? 'en';
  const lingva = await createLingvaSvelteServer({ ...lingvaConfig, project, locale });

  try {
    return {
      locale,
      title: get(lingva.t)('welcome.title'),
    };
  } finally {
    lingva.runtime.destroy();
  }
};
```

Браузер должен создать свой адаптер на основе сериализованной локали.
Так изменяемые хранилища ограничиваются текущим запросом на сервере
и текущим приложением в браузере.

Работающий пример реализации доступен в `examples/sveltekit-starter`.

Для независимо развёрнутых приложений см. раздел
[Микрофронтенды](./microfrontends.md).

Полный пример есть в репозитории: `examples/svelte-starter`.
