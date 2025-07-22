<script setup lang="ts">
// Init Application.
import { getCurrentInstance, onMounted, onUnmounted } from 'vue';
import LocalStorage from '@/stores/localStorage';
import { getPluginSDK } from '@/utils/pluginSDK';

new LocalStorage().checkSchemaVersion();

const app = getCurrentInstance()!.appContext.app
app.config.globalProperties.toast_duration = 5000

// Initialize Plugin SDK
let pluginSDK: ReturnType<typeof getPluginSDK> | null = null;

onMounted(() => {
  // Initialize the plugin SDK when the component is mounted
  pluginSDK = getPluginSDK();
});

onUnmounted(() => {
  // Clean up when component is unmounted
  if (pluginSDK) {
    pluginSDK.destroy();
  }
});
</script>

<template>
  <router-view />
</template>

<style scoped></style>
