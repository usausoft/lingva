<script setup lang="ts">
import { useLingva } from '@lingva/vue';
import { useCookie, useHead } from '#imports';
import type { resources } from './.lingva/generated/project';

const lingva = useLingva<typeof resources>();
const preference = useCookie<'en' | 'ru'>('lingva-locale');
useHead(() => ({ htmlAttrs: { lang: lingva.locale.value } }));

async function selectLocale(locale: 'en' | 'ru') {
  preference.value = locale;
  await lingva.setLocale(locale);
}
</script>

<template>
  <main>
    <article>
      <span>{{ lingva.t('app.badge') }}</span>
      <h1>{{ lingva.t('app.title') }}</h1>
      <p>{{ lingva.t('app.subtitle') }}</p>
      <fieldset>
        <legend>{{ lingva.t('app.locale') }}</legend>
        <button type="button" @click="selectLocale('en')">{{ lingva.t('app.localeEnglish') }}</button>
        <button type="button" @click="selectLocale('ru')">{{ lingva.t('app.localeRussian') }}</button>
      </fieldset>
    </article>
  </main>
</template>

<style>
:root {
  font-family: system-ui, sans-serif;
  color: #172033;
  background: #f4f7fb;
}
body {
  margin: 0;
}
main {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem;
  box-sizing: border-box;
}
article {
  width: min(42rem, 100%);
  padding: 2.5rem;
  border: 1px solid #dce4ef;
  border-radius: 1.5rem;
  background: white;
  box-shadow: 0 1rem 3rem #52657d1a;
}
h1 {
  font-size: clamp(2rem, 7vw, 4rem);
  line-height: 1;
}
fieldset {
  display: flex;
  gap: 0.75rem;
  border: 0;
  padding: 1rem 0 0;
}
button {
  padding: 0.65rem 1rem;
  border: 1px solid #cad5e2;
  border-radius: 0.75rem;
  background: white;
  cursor: pointer;
}
</style>
