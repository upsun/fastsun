<script setup lang="ts">
// Init Application.
import LocalStorage from '@/stores/localStorage';
new LocalStorage().checkSchemaVersion();

</script>

<template>
  <router-view />
</template>

<style scoped></style>
