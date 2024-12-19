import './assets/main.css';

import { createApp } from 'vue';

import Aura from '@primevue/themes/aura';
import PrimeVue from 'primevue/config';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from "primevue/toastservice";

import App from './App.vue';
import router from './router';

const app = createApp(App)
  .use(router)
  .use(PrimeVue,{
    theme: {
        preset: Aura
    }
  })
  .use(ToastService)
  .use(ConfirmationService)
  // .component('Button', Button)
  // .component('Datable', DataTable)
  .mount('#app');

