<script setup lang="ts">
import { type PropType } from 'vue';
import PurgesCard from '@/components/purges/PurgeCard.vue';
import type ProjectEntity from '@/components/project/project.interface';

// Init
const props = defineProps({
  service_id: {
    type: String,
    required: true,
  },
  project_detail: {
    type: Object as PropType<ProjectEntity>,
    required: true,
  },
  vcl_version: {
    type: Number,
    required: true,
  },
});

// Data
</script>

<template>
  <Card>
    <template #title>Project Information</template>
    <template #content>
      <span>Fastly Service ID : </span>
      <Button
        variant="link"
        :href="'https://manage.fastly.com/configure/services/' + service_id"
        target="_blank"
        as="a"
        >{{ service_id }}</Button
      ><br />
      <span>Project ID : </span>
      <Button
        variant="link"
        :href="'https://console.upsun.com/org/' + project_detail!.name"
        target="_blank"
        as="a"
        >{{ project_detail!.name }}</Button
      ><br />
      <span>Current Version : </span><span>{{ vcl_version }}</span><br /><br />
      <PurgesCard :service_id="service_id" /><br />
    </template>
  </Card>
</template>
