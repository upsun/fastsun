<script setup lang="ts">
import { ref, toRaw, watchEffect, onMounted, onUnmounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

import SetupCard from '@/components/SetupCard.vue';
import AclsCard from '@/components/acls/AclCard.vue';
import DomaCard from '@/components/domains/DomainCard.vue';
import HistCard from '@/components/project/HistoryCard.vue';
import InfoCard from '@/components/project/InfoCard.vue';
import StatCard from '@/components/project/StatCard.vue';
import VersCard from '@/components/vcl/VclVersionCard.vue';

import LocalStore from '@/stores/localStorage';
import { useCredentialsStore } from '@/stores/credentialsStore';
import { usePluginSDK, PLUGIN_SRV_PROPS, PLUGIN_TOPIC_VIEW_LOADED } from '@/utils/pluginSDK';

import ProjectAPIService from '@/components/project/project.service';
import type ProjectEntity from '@/components/project/project.interface';

const localStore = new LocalStore();
const credentialsStore = useCredentialsStore();
const toast = useToast();

// Initialize Plugin SDK
const { sdk } = usePluginSDK();
const project_detail = ref<ProjectEntity>({} as ProjectEntity);

function refresh() {
  const serviceId = credentialsStore.getServiceId();
  const serviceToken = credentialsStore.getServiceToken();
  if (!serviceId || !serviceToken) return;
  console.log('FastSun > Refresh Project Detail!');

  const projectService = new ProjectAPIService(serviceId, serviceToken);
  projectService
    .getProject()
    .then((result) => {
      project_detail.value = result;
      credentialsStore.setVclVersion(result.active_version.number);
      if (import.meta.env.DEV) {
        console.log(toRaw(project_detail.value));
      }
    })
    .catch((error) => {
      toast.add({ severity: 'error', summary: 'Error', detail: error, life: 5000 });
    });
}
watchEffect(refresh);

function reload() {
  credentialsStore.loadCredentials();
}

function handleSetupCredentialsSaved(event: {
  projectId: string;
  environmentId: string;
  fastlyId: string;
  fastlyToken: string;
}) {
  credentialsStore.setCredentials(event.fastlyId, event.fastlyToken);
}

function handleInfoCardUpdate(event: string) {
  if (event === 'reload') {
    credentialsStore.clearCredentials();
    project_detail.value = {} as ProjectEntity;
    reload();
  } else if (event === 'save') {
    credentialsStore.saveCredentials();
  }
}

let subViewLoaded: ReturnType<typeof sdk.createSubscription> | null = null;

interface ProjectProps {
  projectId: string;
  environmentId: string;
}

onMounted(async () => {
  localStore.checkSchemaVersion();

  const cltProps = sdk.createClient(PLUGIN_SRV_PROPS);
  const props = (await cltProps.sendRequest(1, '*')) as ProjectProps | null;
  if (!props) {
    credentialsStore.setProjectInfo('default', 'default');
  } else {
    credentialsStore.setProjectInfo(props.projectId, props.environmentId);
  }
  cltProps.destroy();
  credentialsStore.loadCredentials();

  // Debug
  console.log('FastSun > Test > Service ID:', credentialsStore.getServiceId());
  console.log('FastSun > Test > Service Defined:', credentialsStore.serviceIsDefined);
  console.log('FastSun > Test > Project ID:', credentialsStore.getProjectId());
  console.log('FastSun > Test > Environment ID:', credentialsStore.getEnvironmentId());

  subViewLoaded = sdk.createSubscription(PLUGIN_TOPIC_VIEW_LOADED, (data) => {
    console.log('FastSun > Test > Received View Loaded:', data);
  });
  const pubLoaded = sdk.createPublisher(PLUGIN_TOPIC_VIEW_LOADED);
  pubLoaded.publish({ view: 'HomeView', timestamp: new Date().toISOString() });
  pubLoaded.destroy();
});

onUnmounted(() => {
  if (subViewLoaded) subViewLoaded.destroy();
});

const hasFastlyCredentials = computed(() => credentialsStore.getServiceId() && credentialsStore.getServiceToken());
const vclVersionIsDefined = computed(() => credentialsStore.vclVersionIsDefined.value);
</script>

<template>
  <main>
    <div v-if="!hasFastlyCredentials">
      <SetupCard
        :service_id="credentialsStore.getServiceId() || ''"
        :project_id="credentialsStore.getProjectId() || 'default'"
        :environment_id="credentialsStore.getEnvironmentId() || 'default'"
        @update:visible="reload"
        @credentials:saved="handleSetupCredentialsSaved"
      />
    </div>
    <div v-else-if="vclVersionIsDefined">
      <InfoCard
        :service_id="credentialsStore.getServiceId()"
        :service_token="credentialsStore.getServiceToken()"
        :vcl_version="credentialsStore.getVclVersion()"
        :project_id="credentialsStore.getProjectId()"
        :environment_id="credentialsStore.getEnvironmentId()"
        :project_detail="project_detail"
        @update:visible="handleInfoCardUpdate"
      />
      <DomaCard :vcl_version="credentialsStore.getVclVersion()" />
      <StatCard />
      <VersCard />
      <HistCard />
      <AclsCard :vcl_version="credentialsStore.getVclVersion()" />
    </div>
  </main>
</template>
