---
sidebar_position: 6
---

# Angular

`@lingva/angular` связывает типизированную среду выполнения Lingva с внедрением
зависимостей и сигналами Angular. Один контракт конфигурации поддерживает
локальные сгенерированные ресурсы и удалённую доставку наборов переводов.

## Remote: рекомендуемая настройка {#recommended-remote-setup}

Сначала создайте проект в Lingva. Установите SDK и CLI, войдите и выберите проект:

```bash
pnpm add @lingva/angular @lingva/core
pnpm add -D --allow-build=@lingva/cli @lingva/cli
pnpm lingva auth login
pnpm lingva init --mode remote --sdk angular
pnpm lingva check
```

Init создаёт `lingva.config.yaml` и `.lingva/generated/runtime.ts` для удалённой доставки. В разделе **Consumer application setup** проекта создайте SDK-ключ с правом `delivery:read` и настройте его в адаптере среды выполнения с учётом синтаксиса переменных окружения вашего сборщика. Учётные данные публикации должны оставаться только в CLI или на сервере.

Следуйте разделу [Remote в вариантах интеграции](/installation/integration-paths#path-4-hosted-remote-delivery), чтобы подготовить и опубликовать переводы, затем проверить загрузку пакетов приложением.

Передайте сгенерированный `provideAppLingva()` из `src/lingva/providers.ts` в `bootstrapApplication`. Удалённая настройка не создаёт локальный `project.ts`, используемый в примерах запасного варианта ниже.

## Запасной вариант: только Local {#local-only-fallback}

Используйте примеры с локальными ресурсами ниже, только если нужна доставка из репозитория без учётной записи Lingva. Не запускайте init поверх существующей конфигурации: сохраните переводы и проверьте изменения перед сменой режима.

## Установка {#install}

```bash
pnpm add @lingva/angular @lingva/core
pnpm add -D --allow-build=@lingva/cli @lingva/cli
pnpm lingva init --mode local --no-auth --sdk angular
```

Команда создаёт `src/lingva/providers.ts`. Передайте результат
`provideAppLingva()` в `bootstrapApplication`.

## Регистрация адаптера {#register-the-adapter}

Зарегистрируйте один адаптер на границе приложения. Импортируйте тип `resources`
из сгенерированного проекта, чтобы сохранить автодополнение ключей и переменных интерполяции.

```ts
// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideLingvaAngular } from '@lingva/angular';
import lingvaConfig from '../.lingva/generated/runtime';
import project from '../.lingva/generated/project';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [provideLingvaAngular({ ...lingvaConfig, project })],
});
```

## Переводы в компоненте {#translate-in-a-component}

```ts
import { Component } from '@angular/core';
import { injectLingva } from '@lingva/angular';
import type { resources } from '../../.lingva/generated/project';

@Component({
  selector: 'app-welcome',
  standalone: true,
  template: `
    <h1>{{ lingva.t('welcome.title') }}</h1>
    <button (click)="setRussian()">Русский</button>
    @if (lingva.loading()) {
      <small>Loading translations…</small>
    }
  `,
})
export class WelcomeComponent {
  readonly lingva = injectLingva<typeof resources>();

  setRussian() {
    void this.lingva.setLocale('ru').catch(() => undefined);
  }
}
```

Адаптер предоставляет доступные только для чтения сигналы `locale`, `loading`
и `error`. Загрузка локалей отменяет устаревшие удалённые запросы, поэтому при
быстром переключении предыдущий запрос не перезапишет последний выбор.
`setLocale` возвращает promise, который отклоняется при ошибке доставки; в этом
примере ошибка остаётся доступна через `lingva.error()`. Отображайте этот сигнал
ошибки вместе с состоянием загрузки. Promise `ready` браузерного адаптера
завершается после начальной загрузки и записывает ошибки в `error`, но не отклоняется.
Вызывайте `lingva.runtime.destroy()`, когда приложение, владеющее адаптером, уничтожается.

## Серверный рендеринг {#server-rendering}

`createLingvaAngularServer` создаёт адаптер для текущего запроса и дожидается
начального удалённого набора переводов. Уничтожайте его среду выполнения после
рендеринга. Не используйте один адаптер для разных запросов, поскольку его
локаль и состояние сигналов изменяемы.

```ts
import { createLingvaAngularServer } from '@lingva/angular';
// This example module lives in src/.
import lingvaConfig from '../.lingva/generated/runtime';
import project from '../.lingva/generated/project';

export async function createRequestLingva(locale: string) {
  return createLingvaAngularServer({ ...lingvaConfig, project, locale });
}
```

При ошибке начальной доставки фабрика отклоняет promise, вместо того чтобы
рендерить смесь резервного текста и содержимого запрошенной локали.

Для независимо развёрнутых приложений Angular см. раздел
[Микрофронтенды](./microfrontends.md).

Полный пример есть в репозитории: `examples/angular-starter`.
