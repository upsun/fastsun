import './assets/main.css';

import { createApp, provide } from 'vue';

import Aura from '@primevue/themes/aura';
import PrimeVue from 'primevue/config';
import Button from "primevue/button"
import Card from 'primevue/card';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from "primevue/toastservice";

//import 'primevue/resources/themes/saga-blue/theme.css';
//import 'primevue/resources/primevue.min.css';
import 'primeicons/primeicons.css';

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
  .component('Card', Card)
  .component('Button', Button)
  // @see https://vuejs.org/guide/components/provide-inject
  .provide("FASTLY_API_TOKEN", import.meta.env.VITE_FASTLY_API_TOKEN)
  .provide("FASTLY_API_SERVICE", import.meta.env.VITE_FASTLY_API_SERVICE)
  .mount('#app');



