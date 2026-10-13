---
sidebar_position: 4
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Next.js

Пакет Lingva для Next.js пока предоставляет небольшой набор возможностей: он
реэкспортирует API среды выполнения React и добавляет помощник конфигурации для Next.js.
Рекомендуемый подход для App Router — провайдер в клиентском компоненте на границе
приложения; закрытые учётные данные доставки должны оставаться вне браузерной сборки.

## 1. Установите пакеты {#1-install-packages}

<Tabs groupId="package-manager">
  <TabItem value="pnpm" label="pnpm" default>

```bash
pnpm add @lingva/react @lingva/next @lingva/core
pnpm add --save-dev --allow-build=@lingva/cli @lingva/cli
```

  </TabItem>
  <TabItem value="yarn" label="yarn">

```bash
yarn add @lingva/react @lingva/next @lingva/core
yarn add --dev @lingva/cli
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm install @lingva/react @lingva/next @lingva/core
npm install --save-dev @lingva/cli
```

  </TabItem>
</Tabs>

## 2. Создайте начальные файлы для локального режима {#2-scaffold-local-mode}

```bash
pnpm lingva init --mode local --no-auth --sdk next
```

Команда создаёт:

- `lingva.config.yaml`;
- `.lingva/generated/runtime.ts`;
- `.lingva/translations/{locale}.json`;
- `.lingva/generated/project.ts`;
- `src/lingva/provider.tsx`.

Сгенерированный провайдер передаёт собственную конфигурацию и проект, поэтому код
приложения не должен импортировать каждый файл переводов. Его помощник также
регистрирует глобальное значение React по умолчанию, если не передать `register: false`.
Не используйте глобальную конфигурацию, зависящую от запроса, в общих процессах SSR:
в ручном примере ниже регистрация отключена.

Если сначала хотите изучить работающий проект с App Router, откройте
**[стартовый проект Next.js](/installation/next-starter)** в `examples/next-starter`.

## 3. Настройте Next.js {#3-configure-nextjs}

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@lingva/core', '@lingva/react', '@lingva/next'],
};

module.exports = nextConfig;
```

## 4. Подключите провайдер {#4-mount-the-provider}

Сгенерированный провайдер использует `createLingvaNextProvider`, который подготавливает
конфигурацию через `configureLingvaNextClient`. Этот компактный ручной вариант
провайдера отключает необязательную глобальную регистрацию:

```tsx
// src/lingva/provider.tsx
'use client';

import { createLingvaNextProvider } from '@lingva/next';
import lingvaConfig from '../../.lingva/generated/runtime';
import lingvaProject from '../../.lingva/generated/project';

export const AppLingvaProvider = createLingvaNextProvider({
  config: lingvaConfig,
  project: lingvaProject,
  displayName: 'AppLingvaProvider',
  register: false,
});
```

Подключите его один раз на границе приложения:

```tsx
// app/layout.tsx
import type { ReactNode } from 'react';
import { AppLingvaProvider } from '../src/lingva/provider';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppLingvaProvider>{children}</AppLingvaProvider>
      </body>
    </html>
  );
}
```

## 5. Используйте переводы в клиентских компонентах {#5-use-translations-in-client-components}

```tsx
'use client';

import { LingvaText, useLocale, useTranslation } from '@lingva/next';

export function Hero() {
  const { locale, setLocale } = useLocale();
  const { t } = useTranslation();

  return (
    <section>
      <p>{t('home.eyebrow')}</p>
      <h1>
        <LingvaText keyName="home.title" />
      </h1>
      <button onClick={() => setLocale(locale === 'en' ? 'ru' : 'en')}>{t('actions.switchLocale')}</button>
    </section>
  );
}
```

## 6. Поддерживайте переводы в актуальном состоянии {#6-keep-translations-healthy}

Выполняйте эти команды локально и в CI:

```bash
pnpm lingva sync
pnpm lingva check
```

`sync` согласует JSON-файлы локалей с локалью по умолчанию; сгенерированный проект
импортирует эти файлы. Команда не генерирует модули TypeScript заново.
`check` завершается ошибкой, если другие локали отклоняются от контракта ключей
локали по умолчанию.

## Удалённый режим {#remote-mode}

При удалённой доставке закрытые API-ключи не должны попадать в переменные
окружения `NEXT_PUBLIC_*`. Используйте один из подходов:

- Публичная конфигурация доставки только для чтения, чтобы загружать переводы через CDN в браузере.
- Обработчик маршрута Next.js, который добавляет закрытые учётные данные на сервере.
- Публикация и отправка переводов на платформу из CI через `LINGVA_API_KEY` или сохранённые учётные данные `lingva auth`.

Для публикации на платформу с компьютера разработчика скопируйте команду входа
и URL публикации из раздела **Consumer application setup** по адресу
`/app/projects/<project-id>`:

```bash
pnpm lingva auth login
# Stage: pnpm lingva auth login --platform-url https://stage.lingva.dev
pnpm lingva check
pnpm lingva push \
  --api-url "<copy publish URL from Lingva>" \
  --invalidate
```

`pnpm lingva pull --api-url "<copy publish URL from Lingva>"` скачивает переводы
с платформы и объединяет их с локальными файлами локалей. Конфликты изменений
одного ключа вызывают ошибку до записи. Проверяйте защищённую доставку SDK-ключом
с правом `delivery:read`; никогда не передавайте учётные данные публикации в клиентские компоненты.

## Текущие возможности {#current-scope}

Сейчас `@lingva/next` экспортирует `defineLingvaNextConfig`,
`configureLingvaNextClient`, `createLingvaNextProvider`, провайдер и хуки React,
`LingvaText`, а также основные типы Lingva. Специальные помощники для серверных
компонентов запланированы, но пока не входят в API пакета.
