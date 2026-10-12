<script lang="ts">
  import { appLingva } from './lib/lingva';

  const { loading, locale, setLocale, t } = appLingva;

  function changeLocale(event: Event) {
    void setLocale((event.target as HTMLSelectElement).value as 'en' | 'ru');
  }
</script>

<main aria-busy={$loading}>
  <article>
    <p>{$t('app.badge')}</p>
    <h1>{$t('app.title')}</h1>
    <p>{$t('app.subtitle')}</p>
    <label>
      {$t('app.locale')}
      <select value={$locale} onchange={changeLocale}>
        <option value="en">{$t('app.localeEnglish')}</option>
        <option value="ru">{$t('app.localeRussian')}</option>
      </select>
    </label>
  </article>
</main>
