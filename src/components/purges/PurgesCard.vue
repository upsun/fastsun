<script setup lang="ts">
import { Button } from 'primevue';
import PurgeAPIService from './purge.api';
import { inject } from 'vue';
import { useToast } from 'primevue/usetoast';

const FASTLY_API_TOKEN = inject('FASTLY_API_TOKEN') as String;

const toast = useToast();
const props = defineProps({
  service_id: String,
});

async function purgeAll() {
  const purgeService = new PurgeAPIService(props.service_id!, FASTLY_API_TOKEN);
  const [error, data] = await purgeService.purgeAll();

  if (error) {
    console.error(error);
    toast.add({ severity: 'error', summary: 'Error', detail: error[0], life: 1000 })
  } else {
    toast.add({ severity: 'info', summary: 'Purged', life: 1000 })
  }
}
async function purgeUrl(url: String) {
  const purgeService = new PurgeAPIService(props.service_id!, FASTLY_API_TOKEN);
  const [error, data] = await purgeService.purgeUrl(url);

  if (error) {
    console.error(error);
    toast.add({ severity: 'error', summary: 'Error', detail: error[0], life: 1000 })
  } else {
    toast.add({ severity: 'info', summary: 'Purged', life: 1000 })
  }
}
</script>

<template>
  <Button label="Purge All" @click="purgeAll()"></Button>
  <Button label="Purge URL" @click="purgeUrl('')"></Button>
</template>
