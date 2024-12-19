<script setup lang="ts">
import { ref } from 'vue'
import AclCard from '../components/acls/AclCard.vue';

const vcl_version = ref(11)

</script>

<template>
  <main>
    <AclCard :vcl_version="vcl_version" :service_id="service_id" />
  </main>
</template>
