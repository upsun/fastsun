<script setup lang="ts">
import { inject, ref, watchEffect } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from "primevue/button";
import DomainAPIService from './domain.api';

const FASTLY_API_TOKEN = inject('FASTLY_API_TOKEN') as String;

const props = defineProps({
  service_id: String,
  vcl_version: Number
});

const domains = ref([]);

watchEffect(async () => {
  const projectService = new DomainAPIService(props.service_id!, FASTLY_API_TOKEN);
  const [error, data] = await projectService.getDomains(props.vcl_version!);

  if (error) console.error(error);
  else domains.value = data;
});

function AddDomain() {}

function confirmDeleteDomain(domain: any) {}

</script>

<template>
  <Card>
    <template #title v-if="false">Domain Information</template>
    <template #content>
      <DataTable :value="domains" dataKey="id"
          sortField="name" :sortOrder="-1" >
        <template #header>
          <div class="flex flex-wrap gap-2 items-center justify-between">
            <h4 class="m-0" style="display: inline-flex;">Manage Domains</h4>
            <Button label="Add" icon="pi pi-plus" size="small" class="mr-2" style="margin-left: auto;" @click="AddDomain()" />
          </div>
        </template>
        <template #empty> No Domain defined. </template>
        <template #loading> Loading Domains data. Please wait...</template>
        <Column field="name" header="Domain" sortable style="width: 80%"></Column>
        <Column field="created_at" header="Added at" sortable style="width: 70%"></Column>
        <Column :exportable="false" style="min-width: 12rem" header="Actions">
          <template #body="slotProps">
              <Button icon="pi pi-trash" outlined rounded severity="danger" @click="confirmDeleteDomain(slotProps.data)" />
          </template>
        </Column>
      </DataTable>
    </template>
  </Card>
</template>>
