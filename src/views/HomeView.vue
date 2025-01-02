<script setup lang="ts">
import { computed, inject, ref, toRaw, watchEffect } from 'vue';
import { useToast } from 'primevue/usetoast';
import SetuCard from '@/components/SetupCard.vue';
import AclsCard from '@/components/acls/AclCard.vue';
import DomaCard from '@/components/domains/DomainCard.vue';
import HistCard from '@/components/project/HistoryCard.vue';
import InfoCard from '@/components/project/InfoCard.vue';
import StatCard from '@/components/project/StatCard.vue';
import VersCard from '@/components/vcl/VclVersionCard.vue';
import ApiCache from '@/stores/localStorage';

import ProjectAPIService from '@/components/project/project.service';
import type ProjectEntity from '@/components/project/project.interface';

const apiStorage = new ApiCache();
const service_id = ref(apiStorage.getFastlyId());
const service_token = ref(apiStorage.getFastlyToken() || '');
const toast = useToast();

// TODO get current version HERE !
const vcl_version = ref(-1);
const project_detail = ref<ProjectEntity>({} as ProjectEntity);

const serviceIsDefined = computed(() => {
  return service_id.value != '';
})
const vclVersIsDefined = computed(() => {
  return vcl_version.value >= 1;
})

function refresh() {
  if (service_id.value != "") {
    console.log('Refresh Project Detail!');

    const projectService = new ProjectAPIService(service_id.value, service_token.value);
    projectService
      .getProject()
      .then((result) => {
        project_detail.value = result;
        vcl_version.value = result.active_version.number; // Can be refactor with project_detail.

        if (import.meta.env.DEV) {
          console.log(toRaw(project_detail.value));
        }
      })
      .catch((error) => {
        toast.add({ severity: 'error', summary: 'Error', detail: error, life: 3000 });
      });
  }
}
watchEffect(refresh);

function reload() {
  service_id.value = apiStorage.getFastlyId() || '';
  service_token.value = apiStorage.getFastlyToken() || '';
}
</script>

<template>
  <main>
    <SetuCard :service_id="service_id" v-if="!serviceIsDefined" @update:visible="reload" />
    <InfoCard :service_id="service_id" :vcl_version="vcl_version" v-if="serviceIsDefined && vclVersIsDefined" :project_detail="project_detail"/><br />
    <StatCard :service_id="service_id" v-if="serviceIsDefined" /><br />
    <DomaCard :service_id="service_id" :vcl_version="vcl_version" v-if="serviceIsDefined && vclVersIsDefined" /><br />
    <VersCard :service_id="service_id" v-if="serviceIsDefined" /><br />
    <HistCard :service_id="service_id" v-if="serviceIsDefined" /><br />
    <AclsCard :service_id="service_id" :vcl_version="vcl_version" v-if="serviceIsDefined && vclVersIsDefined" />
  </main>
</template>
