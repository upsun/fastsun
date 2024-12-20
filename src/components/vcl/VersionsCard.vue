<script setup lang="ts">
import { inject, ref, watchEffect } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from "primevue/button"
import VclAPIService from './vcl.api';


const FASTLY_API_TOKEN = inject('FASTLY_API_TOKEN') as String;

const toast = useToast();
const props = defineProps({
  service_id: String
});

const versions = ref([]);

watchEffect(async () => {
  const vclService = new VclAPIService(props.service_id!, FASTLY_API_TOKEN);
  const [error, data] = await vclService.getVersions();

  if (error) console.error(error);
  else versions.value = data;

  versions.value.forEach(version => {
    console.log(version);
  });
})

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
          <Button type="button" icon="pi pi-refresh" text />
        </template>
        <template #paginatorend>
          <Button type="button" icon="pi pi-download" text />
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
        <Column field="created_at" header="Created at" sortable style="width: 10%" />
        <Column field="updated_at" header="Updated at" sortable style="width: 10%" />
        <!-- <Column :exportable="false" style="min-width: 12rem">
            <template #body="slotProps">
                <Button icon="pi pi-pencil" outlined rounded class="mr-2" @click="editAcl(slotProps.data)" />
                <Button icon="pi pi-trash" v-if="false" outlined rounded severity="danger" @click="confirmDeleteAcl(slotProps.data)" />
            </template>
        </Column> -->
      </DataTable>
    </template>
  </Card>
</template>
