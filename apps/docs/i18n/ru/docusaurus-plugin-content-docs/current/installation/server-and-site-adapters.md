---
sidebar_position: 11
---

# Node, Electron и Docusaurus

Эти адаптеры используют `@lingva/js`, а не отдельные движки перевода.
Проверьте версию установленного пакета: это руководство описывает API текущего
исходного кода и не подтверждает его наличие в каждой версии реестра.

## Начните с Remote {#start-with-remote}

Для нового приложения следуйте [рекомендуемой настройке Remote](/installation/integration-paths#path-4-hosted-remote-delivery). Передайте сгенерированную удалённую конфигурацию выбранному адаптеру; храните учётные данные сервера вне браузерной сборки. Примеры с локальными ресурсами ниже — запасной вариант для доставки из репозитория.

## Node.js {#nodejs}

Установите среду выполнения и CLI, затем создайте начальные локальные ресурсы JavaScript:

```bash
pnpm add @lingva/node @lingva/core
pnpm add -D --allow-build=@lingva/cli @lingva/cli
pnpm lingva init --mode local --no-auth --sdk vanilla
```

Добавьте `welcome.title` в JSON-файлы локалей, затем создайте среду выполнения:

```ts
import { createLingvaLocaleContext, createLingvaNodeRuntime } from '@lingva/node';
import config from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

const runtime = createLingvaNodeRuntime({ ...config, project });
const context = createLingvaLocaleContext(runtime);
const title = await context.run('en', async () => context.tSync('welcome.title'));
runtime.destroy();
```

`createLingvaLocaleContext` использует AsyncLocalStorage, чтобы ограничить выбор
локали текущим контекстом. Он не изолирует общий изменяемый клиент, не загружает
ресурсы заранее и не делает совместное использование учётных данных пользователей
безопасным. Для удалённой доставки с идентификацией, зависящей от запроса, создавайте
среду выполнения для каждого запроса, дожидайтесь `loadLocale(locale)`, получайте
перевод и вызывайте `destroy()` в `finally`.

`createLingvaLocaleMiddleware` использует сигнатуру Connect/Express
`(request, response, next)` и по умолчанию выбирает первый языковой тег Accept-Language,
без учёта весов предпочтений и проверки поддерживаемых локалей. Если это требуется,
задайте собственный определитель локали. Для других серверных фреймворков нужна
обёртка. Задайте `detectLocale`, чтобы использовать проверенную локаль сессии.
Полный пример промежуточного обработчика см. в [справочнике пакета Node](https://github.com/usausoft/lingva/blob/dev/packages/node/README.md).

`createLingvaNodeFileLoader` возвращает функцию чтения файлов для локальных путей
доставки JSON. `createLingvaNodeRuntime` подключает её автоматически. Для ресурсов
на этапе сборки используйте сгенерированный проект либо дождитесь локальной загрузки
доставки перед `tSync`. Файловый загрузчик работает только в Node: не включайте его
в браузерные сборки.

## Electron {#electron}

```bash
pnpm add @lingva/electron @lingva/core
```

```ts
import { createLingvaElectronRuntime } from '@lingva/electron';
import config from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

const runtime = createLingvaElectronRuntime({ ...config, project });
const title = runtime.tSync('welcome.title');
runtime.destroy();
```

Эта фабрика — простая обёртка над средой выполнения JS. Она не устанавливает
обработчики IPC, не открывает локальные файлы автоматически и не сохраняет наборы
переводов. Храните привилегированные учётные данные в основном процессе или
аутентифицированном серверном приложении; передавайте в процесс отображения
только параметры доставки с правами чтения. Для удалённых ресурсов дождитесь
`loadLocale` перед `tSync`.

## Docusaurus {#docusaurus}

```bash
pnpm add @lingva/docusaurus @lingva/core
```

```ts
import { createLingvaDocusaurusRuntime } from '@lingva/docusaurus';
import config from './.lingva/generated/runtime';
import project from './.lingva/generated/project';

const runtime = createLingvaDocusaurusRuntime({ ...config, project });
const siteTitle = runtime.tSync('welcome.title');
runtime.destroy();
```

Это фабрика JS, а не плагин Docusaurus. Она не создаёт переведённый Markdown,
маршруты, боковые меню, языковые префиксы URL или загрузку из файловой системы.
Настройте i18n Docusaurus отдельно. При сборке статического сайта используйте
ресурсы репозитория; никогда не сериализуйте учётные данные публикации в готовые страницы.

## Общий жизненный цикл и доставка {#shared-lifecycle-and-delivery}

- Синхронное получение перевода требует встроенных или ранее загруженных ресурсов.
- Для удалённой загрузки нужны скопированный URL набора переводов проекта и окружения и ключ с правами чтения.
- В обычной среде выполнения `setLocale` не загружает данные: при переключении удалённых локалей дождитесь `loadLocale`.
- Отписывайте слушателей и уничтожайте среды выполнения по завершении запросов или представлений, которым они принадлежат.
- Разделяйте неизменяемые контракты, а не единственные общие экземпляры среды выполнения, зависящие от запроса.

Подробнее об асинхронном получении переводов, кешировании и аутентификации см. в разделах
[JavaScript](./js.md), [доставка через CDN](./cdn.md) и [конфигурация](./configuration.md).
