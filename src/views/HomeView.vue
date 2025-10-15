<script setup lang="ts">
import { ref, toRaw, watchEffect, onMounted, onUnmounted, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useRoute, useRouter } from 'vue-router';

import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import ProgressSpinner from 'primevue/progressspinner';

import SetupCard from '@/components/SetupCard.vue';
import AclsCard from '@/components/acls/AclCard.vue';
import DomaCard from '@/components/domains/DomainCard.vue';
import HistCard from '@/components/project/HistoryCard.vue';
import InfoCard from '@/components/project/InfoCard.vue';
import StatCard from '@/components/project/StatCard.vue';
import QueryCard from '@/components/project/QueryCard.vue';
import VersCard from '@/components/vcl/VclVersionCard.vue';

import LocalStore from '@/stores/localStorage';
import { useCredentialsStore } from '@/stores/credentialsStore';
import { TAB_VALUES, type TabValue, isValidTabValue } from '@/utils/tabsTools';
import { usePluginSDK } from 'pluginapp-sdk-node';

import ProjectAPIService from '@/components/project/project.service';
import type ProjectEntity from '@/components/project/project.interface';
import { eventBus, EventType } from '@/utils/eventBus';

// Main components
const localStore = new LocalStore();
const credentialsStore = useCredentialsStore();
const toast = useToast();
const route = useRoute();
const router = useRouter();

// Loading state for credentials loading
const isLoadingCredentials = ref(true);

// Reactive variable for active tab
const activeTab = ref<TabValue>(TAB_VALUES.REALTIME);

// Handle tab change
const handleTabChange = (newTab: string | number) => {
  const tabValue = String(newTab) as TabValue;
  if (isValidTabValue(tabValue)) {
    activeTab.value = tabValue;
  }
};

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

interface UrlProps {
  tab?: TabValue;
}

onMounted(async () => {
  localStore.checkSchemaVersion();

  // Listen for VCL version changes to refresh globally
  eventBus.on(EventType.VCL_VERSION_CHANGED, refresh);

  const props = await sdk.getUpsunContext();

  if (!props) {
    credentialsStore.setProjectInfo('default', 'default');
  } else {
    credentialsStore.setProjectInfo(props.projectId, props.environmentId);
  }

  // Load credentials immediately
  credentialsStore.loadCredentials();

  // Add a minimum delay to show the loading spinner (max 500ms)
  setTimeout(() => {
    isLoadingCredentials.value = false;
  }, 800);

  // Debug
  console.log('FastSun > Test > Service ID:', credentialsStore.getServiceId());
  console.log('FastSun > Test > Service Defined:', credentialsStore.serviceIsDefined.value);
  console.log('FastSun > Test > Project ID:', credentialsStore.getProjectId());
  console.log('FastSun > Test > Environment ID:', credentialsStore.getEnvironmentId());
});

onUnmounted(() => {
  eventBus.off(EventType.VCL_VERSION_CHANGED);
});

//// Tab section ////

// Watch URL changes to update active tab
watch(
  () => route.query.tab,
  async (newTab) => {
    // Console mode.
    if (!newTab && !Number.isFinite(Number(newTab))) {
      const urlProps = await sdk.getUrlParams<UrlProps>();
      if (urlProps) {
        newTab = urlProps.tab && isValidTabValue(urlProps.tab) ? urlProps.tab : TAB_VALUES.REALTIME;
      }
    }

    // Standalone mode.
    if (newTab && isValidTabValue(newTab)) {
      activeTab.value = newTab;
    } else if (newTab && !isValidTabValue(newTab)) {
      // If invalid tab, redirect to default tab
      router.replace({
        query: {
          ...route.query,
          tab: TAB_VALUES.REALTIME,
        },
      });
    }
  },
  { immediate: true }, // Execute immediately on component mount
);

// Watch active tab changes to update URL
watch(
  activeTab,
  async (newTab) => {
    if (route.query.tab !== newTab) {
      const query = { ...route.query };
      query.tab = newTab;

      // Clean up date parameters when switching to Real-time tab
      if (newTab === TAB_VALUES.REALTIME) {
        //TODO(Mick): keep or not ?
        // delete query.from;
        // delete query.to;
      }

      // Console mode.
      await sdk.setUrlParams(query);

      // Standalone mode.
      router.replace({ query });
    }
  },
  { flush: 'post' },
); // Ensure DOM updates are complete before navigation

const hasFastlyCredentials = computed(() => credentialsStore.getServiceId() && credentialsStore.getServiceToken());
const vclVersionIsDefined = computed(() => credentialsStore.vclVersionIsDefined.value);
</script>

<template>
  <main>
    <!-- Loading spinner during credentials loading -->
    <div v-if="isLoadingCredentials" class="loading-container">
      <div class="loading-content">
        <ProgressSpinner style="width: 60px; height: 60px" strokeWidth="4" fill="transparent" animationDuration="1s" />
        <p class="loading-text">Loading credentials...</p>
      </div>
    </div>

    <!-- Setup screen if no valid credentials -->
    <div v-else-if="!hasFastlyCredentials">
      <SetupCard
        :service_id="credentialsStore.getServiceId() || ''"
        :project_id="credentialsStore.getProjectId() || 'default'"
        :environment_id="credentialsStore.getEnvironmentId() || 'default'"
        @update:visible="reload"
        @credentials:saved="handleSetupCredentialsSaved"
      />
    </div>

    <!-- Main application if credentials are valid -->
    <div v-else-if="vclVersionIsDefined">
      <Tabs :value="activeTab" @update:value="handleTabChange">
        <TabList>
          <Tab :value="TAB_VALUES.REALTIME">Real-time</Tab>
          <Tab :value="TAB_VALUES.HISTORY">History</Tab>
        </TabList>
        <TabPanels>
          <TabPanel :value="TAB_VALUES.REALTIME">
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
          </TabPanel>
          <TabPanel :value="TAB_VALUES.HISTORY">
            <QueryCard />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  </main>
</template>
