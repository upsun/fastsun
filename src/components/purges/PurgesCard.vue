<script setup lang="ts">
import { inject } from 'vue';
import { Button } from 'primevue';
import { useToast } from 'primevue/usetoast';
import PurgeAPIService from './purge.api';
import { eventBus, EventType } from "@/utils/eventBus";

// Init
const FASTLY_API_TOKEN = inject('FASTLY_API_TOKEN') as string;
const toast = useToast();
const props = defineProps({
  service_id: String,
});

// Events
function purgeAll() {
  console.log("Purge All!");
  const purgeService = new PurgeAPIService(props.service_id!, FASTLY_API_TOKEN);

  purgeService.purgeAll()
  .catch(error => {
    console.error(error);
    toast.add({ severity: 'error', summary: 'Error', detail: error[0], life: 1000 })
  })
  .then(result => {
    toast.add({ severity: 'info', summary: 'Purged', life: 1000 })
    eventBus.emit(EventType.LOG_REFRESH);
  });
}

function purgeUrl(url: string) {
  console.log("Purge URL : " + url);
  const purgeService = new PurgeAPIService(props.service_id!, FASTLY_API_TOKEN);

  purgeService.purgeUrl(url)
  .catch(error => {
    console.error(error);
    toast.add({ severity: 'error', summary: 'Error', detail: error[0], life: 1000 })
  })
  .then(result => {
    toast.add({ severity: 'info', summary: 'Purged', life: 1000 })
    eventBus.emit(EventType.LOG_REFRESH);
  });
}
</script>

<template>
  <Button label="Purge All" @click="purgeAll()"></Button>
  <Button label="Purge URL" @click="purgeUrl('')"></Button>
</template>
