import './assets/main.css';

import { createApp } from 'vue';
import { createI18n, type I18nOptions } from 'vue-i18n';

import Aura from '@primevue/themes/aura';
import PrimeVue from 'primevue/config';
import Button from 'primevue/button';
import Card from 'primevue/card';

import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';

//import 'primevue/resources/themes/saga-blue/theme.css';
//import 'primevue/resources/primevue.min.css';
import 'primeicons/primeicons.css';

import App from './App.vue';
import router from './router';

const dateTimeFormats: I18nOptions['datetimeFormats'] = {
  'en-US': {
    short: {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    },
    long: {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    },
  },
  'fr-FR': {
    short: {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
    long: {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    },
  },
};
const i18n = createI18n({
  // something vue-i18n options here ...
  legacy: false, // you must set `false`, to use Composition API
  locale: 'en-US',
  fallbackLocale: 'en-US',
  availableLocales: ['fr-FR', 'en-US'],
  datetimeFormats: dateTimeFormats,
});

const xpath = "//div[text()='Loading...']";
const matchingElement =
  document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue || '';

const _app = createApp(App)
  .use(i18n)
  .use(router)
  .use(PrimeVue, {
    theme: {
      preset: Aura,
      options: {
        cssLayer: {
          name: 'primevue',
          order: 'tailwind-base, primevue, tailwind-utilities',
        },
      },
    },
  })
  .use(ToastService)
  .use(ConfirmationService)
  .component('Card', Card)
  .component('Button', Button)
  // @see https://vuejs.org/guide/components/provide-inject
  .mount(matchingElement as Element);
//.mount('#app');
