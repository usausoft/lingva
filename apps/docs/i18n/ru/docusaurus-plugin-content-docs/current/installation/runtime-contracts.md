---
sidebar_position: 12
---

# Контракты библиотек и расширенное использование core

Большинству приложений подходит адаптер фреймворка или `@lingva/js`. Используйте `@lingva/core` напрямую для явной сборки проекта, валидации или артефактов на этапе сборки.

```bash
pnpm add @lingva/core
```

## Ресурсы, поиск, резервные значения и переменные {#resources-lookup-fallback-and-variables}

```ts
import { createLingvaResources, defineLingvaProject } from '@lingva/core';

const resources = createLingvaResources({
  en: {
    welcome: 'Hello, {name}!',
    button: [
      { id: 'short', text: 'Save', tone: 'neutral' },
      { id: 'warm', text: 'Save your work', tone: 'warm' },
    ],
  },
  ru: {
    welcome: 'Привет, {name}!',
    button: [
      { id: 'short', text: 'Сохранить', tone: 'neutral' },
      { id: 'warm', text: 'Сохраните изменения', tone: 'warm' },
    ],
  },
});

const project = defineLingvaProject({
  projectId: 'my-app',
  environment: 'dev',
  resources,
  defaultLocale: 'en',
  fallbackLocale: 'en',
});

const client = project.createClient({ locale: 'ru' });
console.log(client.tSync('welcome', { variables: { name: 'Nino' } }));
console.log(client.tSync('button', { variant: 'warm' }));
```

Вложенные словари и плоские ключи с точками используют одинаковый контракт поиска. Конечные значения переводов — строки или непустые массивы вариантов с уникальным `id` и строковым `text`. Селекторы метаданных, например `variant: { tone: 'warm' }`, выбирают подходящие варианты; при отсутствии совпадения выбирается первый вариант. Выбор варианта явный и отделён от форматирования сообщения. Библиотека JS/TS поддерживает сообщения в стиле ICU с `select`, `plural` и `selectordinal`, включая точные селекторы, вложенные ветви и замену `#`. Например, `{count, plural, =0 {No items} one {# item} other {# items}}` выбирает ветвь по `variables: { count: 2 }` и `Intl.PluralRules` для локали приложения. Поддержка ICU неполная: смещения множественного числа и форматирование дат и чисел не реализованы. Не рассчитывайте на выбор суффиксов i18next или произвольный разбор HTML и форматированного текста.

Сохраняйте согласованность плейсхолдеров и структуры вариантов между локалями. Библиотека может использовать резервное содержимое; валидация всё равно сообщает об отсутствующем или несогласованном исходном содержимом. Для собственного резервного значения отсутствующего ключа задайте явный `defaultValue`. Типы улучшают автодополнение известных литеральных ресурсов, но динамически загруженные ресурсы и ключи всё равно требуют проверки во время выполнения.

## Метаданные, валидация и процесс работы {#metadata-validation-and-workflow}

`defineLingvaProject` принимает `keyMetadata`, индексированные развёрнутыми ключами перевода. Метаданные могут содержать описание, пространство имён, теги, переводчика, рецензента и статус (`draft`, `translated`, `reviewed`, `approved`). Эти поля описывают процесс работы, но не предоставляют серверных разрешений.

```ts
import { createLingvaWorkflowSummary, validateLingvaProject, shouldFailLingvaValidation } from '@lingva/core';

const validation = validateLingvaProject(project);
console.log(validation.issues);
const failed = shouldFailLingvaValidation(validation, 'error');
const workflow = createLingvaWorkflowSummary(project);
```

Валидация проверяет синтаксис ключей, контракт перевода и расхождения вариантов, пустые или отсутствующие переводы и полноту метаданных и процесса. Политики определяют причины сбоя CI, но не исправляют файлы. [Справочник CLI](./cli.md) перечисляет коды проблем, фильтры и пороги. Квоты учитывают отдельные развёрнутые ключи, а не символы или копии локалей. Ключ содержит не более 200 ASCII-символов, начинается с буквы или цифры, использует буквы, цифры, `.`, `_`, `-` и не содержит завершающих или последовательных точек.

## Манифесты, пакеты и генерируемый код {#manifests-bundles-and-generated-code}

```ts
import {
  createLingvaProjectManifest,
  createLingvaProjectBundle,
  createLingvaPublishArtifacts,
  formatLingvaProjectTypeScriptModule,
  formatLingvaProjectHelpersModule,
} from '@lingva/core';

const manifest = createLingvaProjectManifest(project);
const bundle = createLingvaProjectBundle(project, { locale: 'ru', includeMetadata: true });
const artifacts = createLingvaPublishArtifacts(project, { locales: ['en', 'ru'] });
const typesSource = formatLingvaProjectTypeScriptModule(manifest);
const helpersSource = formatLingvaProjectHelpersModule(manifest);
```

Эти API возвращают данные или строки исходного кода; они не загружают данные на сервер, не уведомляют доставку об обновлении и не сохраняют файлы. Манифесты описывают ключи, переменные и наличие локалей. Версионированные пакеты включают разрешённые сообщения, варианты, метаданные и происхождение резервных значений. Генерация типов и помощников не пересоздаёт заготовку библиотеки фреймворка. Для операций репозитория используйте команды CLI на Rust `manifest`, `bundle`, `types`, `helpers`, `export` и `import`, не создавая второй движок CLI.

## Доставка и изоляция {#delivery-and-isolation}

`defineLingvaConfig` описывает локальную или CDN-доставку приложения. Переносимый YAML служит источником CLI; сгенерированный `.lingva/generated/runtime.ts` адаптирует его для фреймворков JS. Доставка в браузер может использовать SDK-ключ только для чтения, но никогда токен публикации или администратора. URL CDN — адреса с аутентификацией, а не разрешение анонимного доступа.

Подписки, асинхронный поиск и отмена описаны в [JavaScript](./js.md); кэш памяти и политика обновления — в [CDN-доставке](./cdn.md); изоляция запросов — в [серверных адаптерах](./server-and-site-adapters.md). В руководствах нативных библиотек и Python явно указаны ограничения соответствия валидации и интерполяции; общая фикстура не гарантирует одинаковое поведение.
