import { ChangeDetectionStrategy, Component } from '@angular/core';
import { injectLingva } from '@lingva/angular';
import type { resources } from '../.lingva/generated/project';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main [attr.aria-busy]="lingva.loading()">
      <article>
        <p>{{ lingva.t('app.badge') }}</p>
        <h1>{{ lingva.t('app.title') }}</h1>
        <p>{{ lingva.t('app.subtitle') }}</p>
        <label>
          {{ lingva.t('app.locale') }}
          <select [value]="lingva.locale()" (change)="changeLocale($event)">
            <option value="en">{{ lingva.t('app.localeEnglish') }}</option>
            <option value="ru">{{ lingva.t('app.localeRussian') }}</option>
          </select>
        </label>
      </article>
    </main>
  `,
})
export class AppComponent {
  readonly lingva = injectLingva<typeof resources>();

  changeLocale(event: Event) {
    void this.lingva.setLocale((event.target as HTMLSelectElement).value as 'en' | 'ru');
  }
}
