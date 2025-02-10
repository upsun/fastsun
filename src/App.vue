<script setup lang="ts">
// Init Application.
import { getCurrentInstance } from 'vue';
import LocalStorage from '@/stores/localStorage';
new LocalStorage().checkSchemaVersion();

const app = getCurrentInstance()!.appContext.app
app.config.globalProperties.toast_duration = 5000
</script>

<template>
  <router-view />
</template>

<style scoped></style>
