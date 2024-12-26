<script setup lang="ts">
import { inject, ref, toRaw, watchEffect } from 'vue'
import { useToast } from 'primevue/usetoast';
import AclsCard from '@/components/acls/AclCard.vue';
import DomaCard from '@/components/domains/DomainsCard.vue';
import HistCard from '@/components/project/HistoryCard.vue';
import InfoCard from '@/components/project/InfoCard.vue';
import StatCard from '@/components/project/StatCard.vue';
import VersCard from '@/components/vcl/VersionsCard.vue';
import ProjectAPIService from '@/components/project/project.api';


const service_id = ref(inject("FASTLY_API_SERVICE") as string);
const FASTLY_API_TOKEN = inject('FASTLY_API_TOKEN') as String;
const toast = useToast();

// TODO get current version HERE !
const vcl_version = ref(-1);
const project_detail = ref();

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
    project_detail.value = dataU;
    vcl_version.value = dataU.active_version.number; // Can be refactor with project_detail.

    if (import.meta.env.DEV) {
      console.log(toRaw(project_detail.value));
    }
  });
};
watchEffect(refresh);

</script>

<template>
  <main>
    <InfoCard :service_id="service_id" :vcl_version="vcl_version" v-if="vcl_version >= 1" :project_detail="project_detail"/><br/>
    <StatCard :service_id="service_id" /><br/>
    <DomaCard :service_id="service_id" :vcl_version="vcl_version" v-if="vcl_version >= 1" /><br/>
    <VersCard :service_id="service_id" /><br/>
    <HistCard :service_id="service_id" /><br/>
    <AclsCard :service_id="service_id" :vcl_version="vcl_version" v-if="vcl_version >= 1" />
  </main>
</template>
