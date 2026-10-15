---
sidebar_position: 3
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# React

## Remote: рекомендуемая настройка {#recommended-remote-setup}

Сначала создайте проект в Lingva. Установите SDK и CLI, войдите и выберите проект:

```bash
pnpm add @lingva/react @lingva/core
pnpm add -D --allow-build=@lingva/cli @lingva/cli
pnpm lingva auth login
pnpm lingva init --mode remote --sdk react
pnpm lingva check
```

Init создаёт `lingva.config.yaml` и `.lingva/generated/runtime.ts` для удалённой доставки. В разделе **Consumer application setup** проекта создайте SDK-ключ с правом `delivery:read` и настройте его в адаптере среды выполнения с учётом синтаксиса переменных окружения вашего сборщика. Учётные данные публикации должны оставаться только в CLI или на сервере.

Следуйте разделу [Remote в вариантах интеграции](/installation/integration-paths#path-4-hosted-remote-delivery), чтобы подготовить и опубликовать переводы, затем проверить загрузку пакетов приложением.

Подключите сгенерированный `AppLingvaProvider` из `src/lingva/provider.tsx` на границе браузерного приложения. Для SSR с настройками конкретного запроса передавайте конфигурацию прямо в `LingvaProvider`, а не регистрируйте глобальные значения.

## Запасной вариант: только Local {#local-only-fallback}

Используйте примеры с локальными ресурсами ниже, только если нужна доставка из репозитория без учётной записи Lingva. Не запускайте init поверх существующей конфигурации: сохраните переводы и проверьте изменения перед сменой режима.

## Применение {#usage}

Используйте `@lingva/react`, если вам нужны:

- состояние локали, управляемое провайдером;
- типизированные хуки перевода;
- единый слой интеграции конфигурации среды выполнения Lingva с React.

## Примеры локальной интеграции {#get-started}

Добавьте `@lingva/react`, чтобы интегрировать среду выполнения Lingva с React через провайдер.

### 1. Установите пакет {#1-install-the-package}

<Tabs groupId="package-manager">
  <TabItem value="pnpm" label="pnpm" default>

```bash
pnpm add @lingva/react @lingva/core
pnpm add --save-dev --allow-build=@lingva/cli @lingva/cli
```

  </TabItem>
  <TabItem value="yarn" label="yarn">

```bash
yarn add @lingva/react @lingva/core
yarn add --dev @lingva/cli
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm install @lingva/react @lingva/core
npm install --save-dev @lingva/cli
```

  </TabItem>
</Tabs>

### 2. Оберните приложение в `LingvaProvider` {#2-wrap-your-app-with-lingvaprovider}

Чтобы Lingva подготовила первую обёртку за вас, выполните:

```bash
pnpm lingva init --mode local --no-auth --sdk react
```

Команда создаёт `src/lingva/provider.tsx` с `AppLingvaProvider`.
Также создаются переносимая конфигурация `lingva.config.yaml`, типизированный файл
`.lingva/generated/runtime.ts` и, в локальном режиме, `.lingva/generated/project.ts`.
Сгенерированная React-обёртка регистрирует конфигурацию через глобальное для процесса
значение по умолчанию `configureLingvaReact`. Используйте её в браузерных приложениях
с одним проектом. Для конфигурации SSR, зависящей от запроса, передавайте `config`
явно, как показано ниже.

Общую конфигурацию среды выполнения и скрытый сгенерированный проект можно передать явно:

```tsx
// app/providers.tsx (Next.js App Router)
'use client';

import { LingvaProvider } from '@lingva/react';
import lingvaConfig from '../.lingva/generated/runtime';
import project from '../.lingva/generated/project';

export function Providers({ children }: { children: React.ReactNode }) {
  return <LingvaProvider config={{ ...lingvaConfig, project }}>{children}</LingvaProvider>;
}
```

Браузерные приложения могут выполнить однократную начальную настройку. Не используйте
это глобальное для процесса значение по умолчанию для проектов, учётных данных или
локалей SSR, зависящих от конкретного запроса:

```tsx
'use client';

import { configureLingvaReact, LingvaProvider } from '@lingva/react';
import lingvaConfig from '../.lingva/generated/runtime';
import project from '../.lingva/generated/project';

configureLingvaReact({
  ...lingvaConfig,
  project,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <LingvaProvider>{children}</LingvaProvider>;
}
```

Чтобы сократить объём связующего кода приложения, можно использовать высокоуровневые свойства среды выполнения:

```tsx
'use client';

import { LingvaProvider } from '@lingva/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LingvaProvider
      runtime={{
        mode: 'remote',
        apiUrl: process.env.NEXT_PUBLIC_LINGVA_PUBLISH_API_URL,
        apiKey: process.env.NEXT_PUBLIC_LINGVA_API_KEY,
        projectId: 'website',
        locale: 'en',
        fallbackLocale: 'en',
      }}
    >
      {children}
    </LingvaProvider>
  );
}
```

Скопируйте `NEXT_PUBLIC_LINGVA_PUBLISH_API_URL` и сгенерированный SDK-ключ только для чтения
из целевого окружения на странице настройки проекта. Браузерный ключ должен иметь
только право `delivery:read`: Lingva отклоняет его при редактировании, публикации или
администрировании проекта.

Не раскрывайте ключи администрирования проекта, редактирования или записи доставки
через переменные `NEXT_PUBLIC_*`. Для интерактивной записи через CLI используйте
`lingva auth login`, а отдельный ключ автоматизации с нужными правами храните
только в серверном окружении.

## Расширенное использование {#advanced}

```tsx
// app/layout.tsx
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### 3. Используйте хуки в компонентах {#3-use-hooks-in-components}

```tsx
'use client';

import { useLocale, useTranslation } from '@lingva/react';
import type { resources } from '../.lingva/generated/project';

export function Welcome({ name }: { name: string }) {
  const { t } = useTranslation<typeof resources>();
  const { locale, setLocale } = useLocale<typeof resources>();

  return (
    <div>
      <h1>{t('welcome.title')}</h1>
      <p>{t('welcome.message', { variables: { name } })}</p>
      <button onClick={() => setLocale(locale === 'en' ? 'ru' : 'en')}>Switch locale</button>
      <small>{locale}</small>
    </div>
  );
}
```

С типизированными ресурсами хуки React предлагают автодополнение допустимых ключей
и проверяют наличие переменных интерполяции, необходимых каждому шаблону сообщения.

## Состояние доставки, текстовые компоненты и варианты {#delivery-state-text-components-and-variants}

`useTranslation` возвращает синхронную функцию `t`, а также `locale`, `setLocale`,
`loading` и `error`. При удалённой доставке отображайте состояния загрузки и ошибки,
чтобы временный резервный текст не воспринимался как успешно загруженная локаль:

```tsx
import { LingvaText, useTranslation } from '@lingva/react';

export function Greeting({ name }: { name: string }) {
  const { loading, error } = useTranslation();
  if (loading) return <p>Loading translations…</p>;
  if (error) return <p>Translations unavailable</p>;
  return <LingvaText keyName="welcome.message" variables={{ name }} as="p" />;
}
```

`useLingva` предоставляет базовый клиент, асинхронную функцию `t`, синхронную `tSync`,
`deliveryLoading` и `deliveryError`. Компонент `LingvaText` поддерживает `as`, `variables`,
`defaultValue` и `editable`. Для ключей с вариантами выберите идентификатор варианта
(`variant="short"`) или селектор метаданных (`variant={{ tone: 'warm' }}`). Выбор варианта
явный и отделён от выбора форм множественного числа в сообщениях в стиле ICU.
Произвольный форматированный текст компонент не разбирает.

## Необязательное редактирование в интерфейсе {#optional-in-context-editing}

```tsx
<LingvaProvider
  config={{ ...lingvaConfig, project }}
  editor={{
    enabled: isDevelopment,
    canSave: true,
    onSave: async (payload) => {
      const response = await fetch('/api/translations/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Draft save failed');
    },
  }}
>
  {children}
</LingvaProvider>
```

Обработчик по этому адресу принадлежит приложению: SDK его не устанавливает.
Функция `onSave` получает `key`, `locale`, `value` и необязательный `variantId`.
Ваш сервер должен аутентифицировать пользователя, проверить права на проект
и запись, а также проверить входные данные. `canSave` управляет доступностью действия
в интерфейсе, но не служит авторизацией. При неудачном сохранении выбрасывайте ошибку.
Сохранение черновика само по себе не утверждает и не публикует переводы, а также
не сбрасывает кеш удалённой доставки. Необязательная функция `getStudioUrl` предоставляет
ссылку на редактор переводов вашего приложения.

Так приложения React могут использовать общий контракт среды выполнения для:

- конфигурации провайдера;
- ключей перевода и типов интерполяции;
- согласованного поведения локали во всех компонентах.

### Рабочий процесс React {#react-workflow}

1. Создайте `lingva.config.yaml` и `.lingva/generated/runtime.ts` командой `lingva init --mode local --no-auth --sdk react`.
2. Описывайте локали декларативно в конфигурации и передайте Lingva управление `.lingva/translations/{locale}.json`.
3. Запустите `lingva sync`, чтобы согласовать JSON-файлы локалей: сгенерированный проект импортирует эти файлы.
4. Передайте конфигурацию среды выполнения и сгенерированный проект провайдеру; используйте глобальные значения по умолчанию только в браузерных приложениях с одним проектом.
5. Получайте переводы через `useTranslation()`.
6. Читайте или переключайте локаль через `useLocale()`.
