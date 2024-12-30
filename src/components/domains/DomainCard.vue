<script setup lang="ts">
import { inject, ref, toRaw, watchEffect } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import Button from "primevue/button";

import DomainEntryCard from './DomainEntryCard.vue';
import DomainAPIService from './domain.service';
import type DomainEntity from './domain.interface';


// Init
const FASTLY_API_TOKEN = inject('FASTLY_API_TOKEN') as string;
const toast = useToast();
const props = defineProps({
  service_id: {
    type: String,
    resuired: true,
  },
  vcl_version: {
    type: Number,
    required: true,
  },
});

// Data
const domains = ref<DomainEntity[]>([]);
const domain_selected = ref<DomainEntity>();
const deleteDomainDialog = ref<boolean>(false);
const editDomainDialog = ref<boolean>(false);

function refresh() {
  console.log("Refresh Domain!");
  const projectService = new DomainAPIService(props.service_id!, FASTLY_API_TOKEN);

  projectService.getDomains(props.vcl_version!)
  .then(result => {
    domains.value = result;

    if (import.meta.env.DEV) {
      domains.value.forEach(domain => {
        console.log(toRaw(domain));
      })
    }
  })
  .catch(error => {
    toast.add({ severity: 'error', summary: 'Error', detail: error, life: 3000 });
  });
};
watchEffect(refresh);

// Events
function cleanSelected() {
  domain_selected.value = {} as DomainEntity;
}

function setSelected(domain: DomainEntity) {
  domain_selected.value = domain;
}

function openDomainEditModal() {
  editDomainDialog.value = true;
};

function closeDomainEditModal(updated: boolean) {
  editDomainDialog.value = false;
  cleanSelected()
};

function openDomainDeleteModal() {
  deleteDomainDialog.value = true;
}

function closeDomainDeleteModal() {
  deleteDomainDialog.value = false;
  cleanSelected()
}

function addDomain() {
  console.log("Add domain!");

  cleanSelected()
  openDomainEditModal();
}

function editDomain(domain: DomainEntity) {
  console.log("Edit domain: " + domain.id);

  const clone = JSON.parse(JSON.stringify(domain))
  setSelected(clone);
  openDomainEditModal();
}

function confirmDeleteDomain(domain: DomainEntity) {
  console.log("Delete domain (check): "+ domain.name);

  setSelected(domain);
  openDomainDeleteModal();
}

function deleteDomain() {
  if (domain_selected.value) {
    console.log("Delete domain (make):" + domain_selected.value.name);

    //TODO call remove API
    domains.value = domains.value.filter((val) => val.id !== domain_selected.value!.id);
    closeDomainDeleteModal();

    toast.add({ severity: 'success', summary: 'Successful', detail: 'Domain Deleted', life: 3000 });
  }
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
            <Button label="Add" icon="pi pi-plus" size="small" class="mr-2" style="margin-left: auto;" @click="addDomain()" />
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
        <Column field="name" header="Domain" sortable style="width: 60%"></Column>
        <Column field="created_at" header="Added at (UTC)" sortable style="width: 30%">
          <template #body="slotProps">
            <span>{{ $d(slotProps.data.created_at, 'long') }}</span>
          </template>
        </Column>
        <Column :exportable="false" style="min-width: 8rem" header="Actions">
          <template #body="slotProps">
            <Button icon="pi pi-pencil" outlined rounded @click="editDomain(slotProps.data)" />
            <Button icon="pi pi-trash" outlined rounded severity="danger" @click="confirmDeleteDomain(slotProps.data)" />
          </template>
        </Column>
      </DataTable>
    </template>
  </Card>

  <DomainEntryCard v-if="editDomainDialog" :domain_data="domain_selected" :domain_state_dialog="editDomainDialog" @update:visible="closeDomainEditModal" />

  <Dialog v-model:visible="deleteDomainDialog" :style="{ width: '450px' }" header="Confirm" :modal="true">
    <div class="flex items-center gap-4">
        <i class="pi pi-exclamation-triangle !text-3xl" />
        <span v-if="domain_selected"
            >Are you sure you want to delete <b>{{ domain_selected.name }}</b>?</span
        >
    </div>
    <template #footer>
        <Button label="No" icon="pi pi-times" text @click="deleteDomainDialog = false" />
        <Button label="Yes" icon="pi pi-check" @click="deleteDomain" />
    </template>
  </Dialog>
</template>>
