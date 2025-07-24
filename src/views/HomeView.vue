<script setup lang="ts">
import { ref, toRaw, watchEffect, onMounted, onUnmounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import SetuCard from '@/components/SetupCard.vue';
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

// TODO get current version HERE !
const project_detail = ref<ProjectEntity>({} as ProjectEntity);

function refresh() {
  if (credentialsStore.serviceIsDefined) {
    console.log('FastSun > Refresh Project Detail!');

    const projectService = new ProjectAPIService(credentialsStore.getServiceId(), credentialsStore.getServiceToken());
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
  // Update credentials in store
  credentialsStore.setCredentials(event.fastlyId, event.fastlyToken);
}

function handleInfoCardUpdate(event: string) {
  if (event === 'reload') {
    credentialsStore.clearCredentials();
    project_detail.value = {} as ProjectEntity;
    reload();
  } else if (event === 'save') {
    // Save current credentials when updated
    credentialsStore.saveCredentials();
  }
}

// Plugin SDK usage example
let subViewLoaded: ReturnType<typeof sdk.createSubscription> | null = null;

interface ProjectProps {
  projectId: string;
  environmentId: string;
}

onMounted(async () => {
  // Initialize localStorage schema
  localStore.checkSchemaVersion();

  // Sync call (aka client/service)
  const cltProps = sdk.createClient(PLUGIN_SRV_PROPS);
  const props = (await cltProps.sendRequest(1, '*')) as ProjectProps | null;
  if (!props) {
    console.warn('FastSun > Test > No properties received from SDK.');
    // Fallback to default project and environment for backward compatibility
    credentialsStore.setProjectInfo('default', 'default');
  } else {
    console.log('FastSun > Test > Received Properties:', props);
    credentialsStore.setProjectInfo(props.projectId, props.environmentId);
  }
  cltProps.destroy();

  // Load credentials for the current project and environment
  credentialsStore.loadCredentials();

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
    <!-- SECURITY WARNING: Les props service_id et service_token exposent des données sensibles -->
    <!-- TODO: Refactoriser tous les composants enfants pour utiliser le store credentialsStore -->
    <!-- Voir l'exemple dans StatCardSecure.vue pour la migration -->

    <SetuCard
      :service_id="credentialsStore.getServiceId()"
      :project_id="credentialsStore.getProjectId()"
      :environment_id="credentialsStore.getEnvironmentId()"
      v-if="!credentialsStore.serviceIsDefined"
      @update:visible="reload"
      @credentials:saved="handleSetupCredentialsSaved"
    />
    <InfoCard
      :service_id="credentialsStore.getServiceId()"
      :service_token="credentialsStore.getServiceToken()"
      :vcl_version="credentialsStore.getVclVersion()"
      :project_id="credentialsStore.getProjectId()"
      :environment_id="credentialsStore.getEnvironmentId()"
      v-if="credentialsStore.serviceIsDefined && credentialsStore.vclVersionIsDefined"
      :project_detail="project_detail"
      @update:visible="handleInfoCardUpdate"
    />

    <!-- Exemple d'utilisation sécurisée (sans props de tokens) -->
    <!-- <StatCardSecure v-if="credentialsStore.serviceIsDefined" /> -->

    <!-- ✅ SÉCURISÉ: Tous les composants utilisent maintenant le store centralisé -->
    <StatCard v-if="credentialsStore.serviceIsDefined" />
    <DomaCard
      :vcl_version="credentialsStore.getVclVersion()"
      v-if="credentialsStore.serviceIsDefined && credentialsStore.vclVersionIsDefined"
    />
    <VersCard v-if="credentialsStore.serviceIsDefined" />
    <HistCard v-if="credentialsStore.serviceIsDefined" />
    <AclsCard
      :vcl_version="credentialsStore.getVclVersion()"
      v-if="credentialsStore.serviceIsDefined && credentialsStore.vclVersionIsDefined"
    />
  </main>
</template>
