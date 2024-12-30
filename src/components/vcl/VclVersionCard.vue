<script setup lang="ts">
import { inject, ref, toRaw, watchEffect } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from "primevue/button";

import DisplayVclCard from './VclDisplayCard.vue';
import VclAPIService from './vcl.service';
import type VclEntity from './vcl.interface';


// Init
const FASTLY_API_TOKEN = inject('FASTLY_API_TOKEN') as string;
const toast = useToast();
const props = defineProps({
  service_id: {
    type: String,
    required: true,
  },
});

// Data
const versions = ref<VclEntity[]>([]);
const vcl_selected = ref<VclEntity>();
const displayVclDialog = ref<boolean>(false);

function refresh() {
  console.log("Refresh Version History!");
  const vclService = new VclAPIService(props.service_id!, FASTLY_API_TOKEN);

  vclService.getVersions()
  .then(result => {
    versions.value = result;

    if (import.meta.env.DEV) {
      versions.value.forEach(version => {
        console.log(toRaw(version));
      });
    }
  })
  .catch(error => {
    toast.add({ severity: 'error', summary: 'Error', detail: error, life: 3000 });
  });
};
watchEffect(refresh);

// Events
function openVclDisplayModal() {
  displayVclDialog.value = true;
};

function closeVclDisplayModal() {
  displayVclDialog.value = false;
  vcl_selected.value = {} as VclEntity;
};

function showVCL(data: VclEntity) {
  console.log("Display VCL!");

  const vclService = new VclAPIService(props.service_id!, FASTLY_API_TOKEN);
  vclService.getVCL(data.number)
  .then(result => {
    vcl_selected.value = data;

    // Extra content
    const [dataRaw, dataHtml] = result;
    vcl_selected.value!.contentHtml = dataHtml.content;
    vcl_selected.value!.contentRaw = dataRaw.content;

    openVclDisplayModal();
  })
  .catch(error => {
    toast.add({ severity: 'error', summary: 'Error', detail: error, life: 3000 });
  });
}
</script>

<template>
  <Card>
    <template #title v-if="false">Manage Version</template>
    <template #content>
      <DataTable :value="versions" dataKey="id"
            stripedRows
            resizableColumns columnResizeMode="fit"
            sortField="number" :sortOrder="-1" :defaultSortOrder="-1"
            :paginator="true" :rows="5" :rowsPerPageOptions="[5, 10, 20, 50]"
            paginatorTemplate="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
            currentPageReportTemplate="{first} to {last} of {totalRecords}"
            >
        <template #paginatorstart>
          <Button type="button" icon="pi pi-refresh" text @click="refresh"/>
        </template>
        <template #paginatorend>
          <Button type="button" v-if="false" icon="pi pi-download" text />
        </template>
        <template #header>
          <div class="flex flex-wrap gap-2 items-center justify-between">
            <h4 class="m-0">Versions History</h4>
          </div>
        </template>
        <template #empty> No Versions found. </template>
        <template #loading> Loading versions data. Please wait. </template>
        <Column field="number" header="Version" sortable style="width: 10%">
          <template #body="slotProps">
            <span>Version {{ slotProps.data.number }}</span>
            <span class="pi pi-stopwatch" v-if="slotProps.data.active"></span>
            <span class="pi pi-lock" v-else></span>
          </template>
        </Column>
        <Column field="comment" header="Comment" sortable style="width: 30%" />
        <Column field="created_at" header="Created at (UTC)" sortable style="width: 10%">
          <template #body="slotProps">
            <span>{{ $d(slotProps.data.created_at, 'long') }}</span>
          </template>
        </Column>
        <Column field="updated_at" header="Updated at (UTC)" sortable style="width: 10%">
          <template #body="slotProps">
            <span>{{ $d(slotProps.data.updated_at, 'long') }}</span>
          </template>
        </Column>
        <Column :exportable="false" style="min-width: 8rem">
            <template #body="slotProps">
                <Button icon="pi pi-search" outlined rounded class="mr-2" @click="showVCL(slotProps.data)" />
                <!-- <Button icon="pi pi-pencil" outlined rounded class="mr-2" @click="editVCL(slotProps.data)" />
                <Button icon="pi pi-trash" v-if="false" outlined rounded severity="danger" @click="confirmDeleteVCL(slotProps.data)" /> -->
            </template>
        </Column>
      </DataTable>
    </template>
  </Card>

  <DisplayVclCard v-if="displayVclDialog" :vcl_data="vcl_selected" :vcl_state_dialog="displayVclDialog" @update:visible="closeVclDisplayModal"/>
</template>
