<script setup lang="ts">
import { inject, ref, watchEffect } from 'vue';
import PurgesCard from '@/components/purges/PurgesCard.vue';

const props = defineProps({
  service_id: String,
  vcl_version: Number
});


</script>

<template>
  <Card>
    <template #title>Project Information</template>
    <template #content>
      <span>Fastly Service ID :</span><span>{{service_id}}</span><br />
      <span>Project ID :</span><span>{{upsun_id}}</span><br />
      <span>Current Version :</span><span>{{vcl_version}}</span><br /><br />
      <PurgesCard :service_id="service_id" /><br/>
    </template>
  </Card>
</template>>
