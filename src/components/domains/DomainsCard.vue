<script setup lang="ts">
import { inject, ref, toRaw, watchEffect } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from "primevue/button";
import DomainAPIService from './domain.api';

// Init
const FASTLY_API_TOKEN = inject('FASTLY_API_TOKEN') as String;
const toast = useToast();
const props = defineProps({
  service_id: String,
  vcl_version: Number
});

// Data
const domains = ref([]);
function refresh() {
  console.log("Refresh Domain!");
  const projectService = new DomainAPIService(props.service_id!, FASTLY_API_TOKEN);

  projectService.getDomains(props.vcl_version!)
  .catch(error => {
    console.error(error);
    toast.add({ severity: 'error', summary: 'Error', detail: error, life: 3000 });
  })
  .then(result => {
    const [error, data] = result;
    domains.value = data;

    if (import.meta.env.DEV) {
      domains.value.forEach(domain => {
        console.log(toRaw(domain));
      })
    }
  });
};
watchEffect(refresh);

// Events
function AddDomain() {
  console.log("Add domain!");
  toast.add({
    severity: 'warn',
    summary: 'Not Implemented',
    detail: 'This feature is currently not implemented !',
    life: 3000 });

  if (true) refresh();
}

function editDomain() {
  if (true) refresh();
}

function confirmDeleteDomain(domain: any) {
  console.log("Delete domain : "+ domain.name);
  toast.add({
    severity: 'warn',
    summary: 'Not Implemented',
    detail: `This feature is currently not implemented !<br/> For ${domain.name}`,
    life: 3000 });
}
</script>

<template>
  <Card>
    <template #title v-if="false">Domain Information</template>
    <template #content>
      <DataTable :value="domains" dataKey="id"
          sortField="name" :sortOrder="-1"
          :paginator="true" :rows="5" :rowsPerPageOptions="[5, 10, 20, 50]"
          paginatorTemplate="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
          currentPageReportTemplate="{first} to {last} of {totalRecords}"
          >
        <template #header>
          <div class="flex flex-wrap gap-2 items-center justify-between">
            <h4 class="m-0" style="display: inline-flex;">Manage Domains</h4>
            <Button label="Add" icon="pi pi-plus" size="small" class="mr-2" style="margin-left: auto;" @click="AddDomain()" />
          </div>
        </template>
        <template #paginatorstart>
          <Button type="button" icon="pi pi-refresh" text @click="refresh"/>
        </template>
        <template #paginatorend>
          <Button type="button" v-if="false" icon="pi pi-download" text />
        </template>
        <template #empty> No Domain defined. </template>
        <template #loading> Loading Domains data. Please wait...</template>
        <Column field="name" header="Domain" sortable style="width: 80%"></Column>
        <Column field="created_at" header="Added at" sortable style="width: 70%"></Column>
        <Column :exportable="false" style="min-width: 12rem" header="Actions">
          <template #body="slotProps">
            <Button icon="pi pi-pencil" outlined rounded @click="editDomain(slotProps.data)" />
              <Button icon="pi pi-trash" outlined rounded severity="danger" @click="confirmDeleteDomain(slotProps.data)" />
          </template>
        </Column>
      </DataTable>
    </template>
  </Card>
</template>>
