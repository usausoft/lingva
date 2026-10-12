import { createApp } from 'vue';
import { createLingvaVue } from '@lingva/vue';
import lingvaConfig from '../lingva.config';
import lingvaProject, { type resources } from '../.lingva/generated/project';
import App from './App.vue';

const app = createApp(App);

app.use(createLingvaVue<typeof resources>({ ...lingvaConfig, project: lingvaProject })).mount('#app');
