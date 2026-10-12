<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.title}</title></svelte:head>

<main>
  <article>
    <span>{data.badge}</span>
    <h1>{data.title}</h1>
    <p>{data.subtitle}</p>
    <form method="POST" action="?/locale">
      <fieldset>
        <legend>{data.localeLabel}</legend>
        <button name="locale" value="en" aria-pressed={data.locale === 'en'}>{data.localeEnglish}</button>
        <button name="locale" value="ru" aria-pressed={data.locale === 'ru'}>{data.localeRussian}</button>
      </fieldset>
    </form>
  </article>
</main>

<style>
  :global(:root) { font-family: system-ui, sans-serif; color: #172033; background: #f4f7fb; }
  :global(body) { margin: 0; }
  main { min-height: 100vh; display: grid; place-items: center; padding: 2rem; box-sizing: border-box; }
  article { width: min(42rem, 100%); padding: 2.5rem; border: 1px solid #dce4ef; border-radius: 1.5rem; background: white; box-shadow: 0 1rem 3rem #52657d1a; }
  h1 { font-size: clamp(2rem, 7vw, 4rem); line-height: 1; }
  fieldset { display: flex; gap: 0.75rem; border: 0; padding: 1rem 0 0; }
  button { padding: 0.65rem 1rem; border: 1px solid #cad5e2; border-radius: 0.75rem; background: white; cursor: pointer; }
  button[aria-pressed='true'] { color: white; background: #172033; }
</style>
