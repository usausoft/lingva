<script setup lang="ts">
import { useLingva } from '@lingva/vue';
import type { resources } from '../.lingva/generated/project';

const { locale, t, setLocale } = useLingva<typeof resources>();
</script>

<template>
  <main class="min-h-screen bg-slate-950 px-6 py-16 text-white">
    <section
      class="mx-auto max-w-3xl rounded-[2rem] border border-cyan-300/20 bg-white/10 p-8 shadow-2xl shadow-cyan-950/40 backdrop-blur"
    >
      <p class="text-sm font-semibold tracking-[0.3em] text-cyan-200 uppercase">
        {{ t('app.badge') }}
      </p>
      <h1 class="mt-5 text-4xl font-black tracking-tight sm:text-6xl">
        {{ t('app.title') }}
      </h1>
      <p class="mt-5 text-lg leading-8 text-slate-200">
        {{ t('app.subtitle') }}
      </p>

      <div class="mt-8 flex flex-wrap items-center gap-4">
        <label class="text-sm font-semibold text-slate-200">
          {{ t('app.locale') }}
          <select
            class="ml-3 rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-white"
            :value="locale"
            @change="setLocale(($event.target as HTMLSelectElement).value as 'en' | 'ru')"
          >
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>
        </label>
        <a
          class="rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
          href="/admin/users"
        >
          {{ t('app.cta') }}
        </a>
      </div>

      <aside class="mt-10 rounded-3xl border border-white/10 bg-slate-900/80 p-5">
        <h2 class="text-xl font-bold">{{ t('dashboard.card.title') }}</h2>
        <p class="mt-2 leading-7 text-slate-300">
          {{ t('dashboard.card.body') }}
        </p>
      </aside>
    </section>
  </main>
</template>
