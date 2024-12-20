<script setup lang="ts">
import { inject, ref } from 'vue'
import AclCard from '@/components/acls/AclCard.vue';
import VersionsCard from '@/components/vcl/VersionsCard.vue';
import InfoCard from '@/components/project/InfoCard.vue';
import DomainsCard from '@/components/domains/DomainsCard.vue';

const service_id = ref(inject("FASTLY_API_SERVICE") as string);
const vcl_version = ref(2);
</script>

<template>
  <main>
    <InfoCard :vcl_version="vcl_version" :service_id="service_id" /><br/>
    <DomainsCard :vcl_version="vcl_version" :service_id="service_id" /><br/>
    <VersionsCard :service_id="service_id" /><br/>
    <AclCard :vcl_version="vcl_version" :service_id="service_id" />
  </main>
</template>
