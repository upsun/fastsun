<script setup lang="ts">
import { inject } from 'vue';
import { Button } from 'primevue';
import { useToast } from 'primevue/usetoast';
import PurgeAPIService from './purge.service';
import { eventBus, EventType } from "@/utils/eventBus";

// Init
const FASTLY_API_TOKEN = inject('FASTLY_API_TOKEN') as string;
const toast = useToast();
const props = defineProps({
  service_id: {
    type: String,
    required: true,
  },
});

// Events
function purgeAll() {
  console.log("Purge All!");
  const purgeService = new PurgeAPIService(props.service_id!, FASTLY_API_TOKEN);

  purgeService.purgeAll()
  .then(() => {
    toast.add({ severity: 'info', summary: 'Purged', life: 1000 })
    eventBus.emit(EventType.LOG_REFRESH);
  })
  .catch(error => {
    toast.add({ severity: 'error', summary: 'Error', detail: error[0], life: 1000 })
  });
}

function purgeUrl(url: string) {
  console.log("Purge URL : " + url);
  const purgeService = new PurgeAPIService(props.service_id!, FASTLY_API_TOKEN);

  purgeService.purgeUrl(url)
  .then(() => {
    toast.add({ severity: 'info', summary: 'Purged', life: 1000 })
    eventBus.emit(EventType.LOG_REFRESH);
  })
  .catch(error => {
    toast.add({ severity: 'error', summary: 'Error', detail: error[0], life: 1000 })
  });
}
</script>

<template>
  <Button label="Purge All" @click="purgeAll()"></Button>
  <Button label="Purge URL" @click="purgeUrl('')"></Button>
</template>
