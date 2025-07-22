<script setup lang="ts">
import { computed, ref, toRaw, watchEffect, onMounted, onUnmounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import SetuCard from '@/components/SetupCard.vue';
import AclsCard from '@/components/acls/AclCard.vue';
import DomaCard from '@/components/domains/DomainCard.vue';
import HistCard from '@/components/project/HistoryCard.vue';
import InfoCard from '@/components/project/InfoCard.vue';
import StatCard from '@/components/project/StatCard.vue';
import VersCard from '@/components/vcl/VclVersionCard.vue';
import LocalStore from '@/stores/localStorage';
import { usePluginSDK, PLUGIN_SRV_PROPS, PLUGIN_TOPIC_VIEW_LOADED } from '@/utils/pluginSDK';

import ProjectAPIService from '@/components/project/project.service';
import type ProjectEntity from '@/components/project/project.interface';

const localStore = new LocalStore();
const service_id = ref(localStore.getFastlyId());
const service_token = ref(localStore.getFastlyToken() || '');
const toast = useToast();

// Initialize Plugin SDK
const { sdk } = usePluginSDK();

// TODO get current version HERE !
const vcl_version = ref(-1);
const project_detail = ref<ProjectEntity>({} as ProjectEntity);

const serviceIsDefined = computed(() => {
  return service_id.value != '' && service_token.value != '';
});
const vclVersIsDefined = computed(() => {
  return vcl_version.value >= 1;
});

const isAdmin = computed(() => {
  return localStore.isAdminMode();
});

function refresh() {
  if (service_id.value != '' && service_token.value != '') {
    console.log('FastSun > Refresh Project Detail!');

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
        toast.add({ severity: 'error', summary: 'Error', detail: error, life: 5000 });
      });
  }
}
watchEffect(refresh);

function reload() {
  service_id.value = localStore.getFastlyId() || '';
  service_token.value = localStore.getFastlyToken() || '';
}

// Plugin SDK usage example
let subViewLoaded: ReturnType<typeof sdk.createSubscription> | null = null;

onMounted(async () => {
  // Sync call (aka client/service)
  const cltProps = sdk.createClient(PLUGIN_SRV_PROPS);
  const props = await cltProps.sendRequest(1, '*');
  if (!props) {
    console.warn('FastSun > Test > No properties received from SDK.');
  } else {
    console.log('FastSun > Test > Received Properties:', props);
  }
  cltProps.destroy();

  // Async Subscribe to view loaded event
  subViewLoaded = sdk.createSubscription(PLUGIN_TOPIC_VIEW_LOADED, (data) => {
    console.log('FastSun > Test > Received View Loaded:', data);
  });

  // Async Publish view loaded event
  const pubLoaded = sdk.createPublisher(PLUGIN_TOPIC_VIEW_LOADED);
  pubLoaded.publish({ view: 'HomeView', timestamp: new Date().toISOString() });
  pubLoaded.destroy();
});

onUnmounted(() => {
  // Clean up subscriptions if necessary
  if (subViewLoaded) subViewLoaded.destroy();
});
</script>

<template>
  <main>
    <SetuCard :service_id="service_id" v-if="!serviceIsDefined" @update:visible="reload" />
    <InfoCard
      :service_id="service_id"
      :vcl_version="vcl_version"
      v-if="serviceIsDefined && vclVersIsDefined"
      :project_detail="project_detail"
    />
    <StatCard :service_id="service_id" v-if="serviceIsDefined" />
    <DomaCard
      :service_id="service_id"
      :vcl_version="vcl_version"
      v-if="serviceIsDefined && vclVersIsDefined && isAdmin"
    />
    <VersCard :service_id="service_id" v-if="serviceIsDefined && isAdmin" />
    <HistCard :service_id="service_id" v-if="serviceIsDefined" />
    <AclsCard :service_id="service_id" :vcl_version="vcl_version" v-if="serviceIsDefined && vclVersIsDefined" />
  </main>
</template>
