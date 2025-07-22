<script setup lang="ts">
import { computed, ref, type Ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';

import PurgeAPIService from './purge.service';
import { eventBus, EventType } from '@/utils/eventBus';
import ApiCache from '@/stores/localStorage';

// Init
const service_token = new ApiCache().getFastlyToken() || '';
const emit = defineEmits(['update:visible']);
const toast = useToast();
const props = defineProps({
  service_id: {
    type: String,
    required: true,
  },
});
const submitted = ref<boolean>(false);
const validated = ref<boolean>(true);
const purgeUrlDialog = ref<boolean>(false);
const url2purge = ref<string>('');

// Events
function purgeAll() {
  console.log('FastSun > Purge All!');
  const purgeService = new PurgeAPIService(props.service_id!, service_token);

  purgeService
    .purgeAll()
    .then(() => {
      toast.add({
        severity: 'info',
        summary: 'Purge All',
        detail: 'Process to purge all with success !\nThis will be applied in a few seconds...',
        life: 5000,
      });
      eventBus.emit(EventType.LOG_REFRESH);
    })
    .catch((error) => {
      toast.add({ severity: 'error', summary: 'Purge All error', detail: error[0], life: 5000 });
    });
}

function purgeUrl() {
  submitted.value = true;
  validated.value = true;

  if (url2purge.value != '') {
    console.log('FastSun > Purge URL : ' + url2purge.value);
    const purgeService = new PurgeAPIService(props.service_id!, service_token);
    const regex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}/gm;
    validated.value = regex.test(url2purge.value);

    if (validated.value) {
      purgeService
        .purgeUrl(url2purge.value)
        .then(() => {
          toast.add({
            severity: 'info',
            summary: 'Purge URL',
            detail: 'Process to purge ' + url2purge.value + '\nThis will be applied in a few seconds...',
            life: 5000,
          });
          eventBus.emit(EventType.LOG_REFRESH);
          closeModal();
        })
        .catch((error) => {
          toast.add({ severity: 'error', summary: 'Purge URL error', detail: error[0], life: 5000 });
        });
    }
  }
}

function closeModal() {
  purgeUrlDialog.value = false;
}
</script>

<template>
  <Button label="Purge All" @click="purgeAll()"></Button>
  <Button label="Purge URL" @click="purgeUrlDialog = true"></Button>

  <Dialog
    v-bind:visible="purgeUrlDialog"
    @update:visible="closeModal"
    :style="{ width: '900px' }"
    header="Purge a URL"
    :modal="true"
  >
    <div>
      <label for="url" class="block font-bold mb-3">Full URL</label>
      <InputText
        id="url"
        v-model.trim="url2purge"
        required="true"
        autofocus
        :invalid="submitted && (!url2purge || !validated)"
        aria-describedby="username-help"
        fluid
      />
      <small v-if="submitted && !url2purge" class="text-red-500">URL is required.</small>
      <small v-if="submitted && !validated" class="text-red-500">URL is malformed.</small>
      <Message size="small" severity="secondary" variant="simple">Eg. https://domain.tld/</Message>
    </div>
    <template #footer>
      <Button label="Purge URL" @click="purgeUrl"></Button>
    </template>
  </Dialog>
</template>
