<script setup lang="ts">
import { inject, ref, toRaw, watchEffect } from 'vue'
import { useToast } from 'primevue/usetoast';
import AclCard from '@/components/acls/AclCard.vue';
import VersionsCard from '@/components/vcl/VersionsCard.vue';
import InfoCard from '@/components/project/InfoCard.vue';
import DomainsCard from '@/components/domains/DomainsCard.vue';
import HistoryCard from '@/components/project/HistoryCard.vue';
import ProjectAPIService from '@/components/project/project.api';
import StatCard from '@/components/project/StatCard.vue';

const service_id = ref(inject("FASTLY_API_SERVICE") as string);
const FASTLY_API_TOKEN = inject('FASTLY_API_TOKEN') as String;
const toast = useToast();

// TODO get current version HERE !
const vcl_version = ref(-1);
const detail = ref();

function refresh() {
  console.log("Refresh Project Detail!");
  const projectService = new ProjectAPIService (service_id.value, FASTLY_API_TOKEN);

  projectService.getProject()
  .catch(error => {
    console.error(error);
    toast.add({ severity: 'error', summary: 'Error', detail: error, life: 3000 });
  })
  .then(result => {
    const [errorU, dataU] = result;
    detail.value = dataU;
    vcl_version.value = dataU.version.number;

    if (import.meta.env.DEV) {
      console.log(toRaw(detail.value));
    }
  });
};
watchEffect(refresh);

</script>

<template>
  <main>
    <InfoCard v-if="vcl_version >= 0" :vcl_version="vcl_version" :service_id="service_id" /><br/>
    <StatCard :service_id="service_id"/><br/>
    <DomainsCard v-if="vcl_version >= 0" :vcl_version="vcl_version" :service_id="service_id" /><br/>
    <VersionsCard :service_id="service_id" /><br/>
    <HistoryCard :service_id="service_id" /><br/>
    <AclCard v-if="vcl_version >= 0" :vcl_version="vcl_version" :service_id="service_id" />
  </main>
</template>
