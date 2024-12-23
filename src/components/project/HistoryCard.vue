<script setup lang="ts">
import { inject, onMounted, onBeforeUnmount, ref, toRaw, watchEffect } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from "primevue/button"
import ProjectAPIService from './project.api';
import { eventBus, EventType } from "@/utils/eventBus";

// Init
const FASTLY_API_TOKEN = inject('FASTLY_API_TOKEN') as String;
const toast = useToast();
const props = defineProps({
  service_id: String
});
onMounted(() => {
  eventBus.on(EventType.LOG_REFRESH, refresh);
})

onBeforeUnmount(() => {
  eventBus.off(EventType.LOG_REFRESH);
});

// Data
const activities = ref([]);
const cacheUser = new Map<string, string>();
// Or use Computed()
function refresh() {
  console.log("Refresh Activities History!");
  const projectService = new ProjectAPIService (props.service_id!, FASTLY_API_TOKEN);

  projectService.getActivities()
  .catch(error => {
    console.error(error);
    toast.add({ severity: 'error', summary: 'Error', detail: error, life: 3000 });
  })
  .then(result => {
    const [error, data] = result;
    activities.value = data.data;

    if (import.meta.env.DEV) {
      activities.value.forEach(activitie => {
        console.log(toRaw(activitie));
      });
    }

    activities.value.forEach((activitie: Object) => {
      const user_id = activitie.attributes.user_id;

      if (!cacheUser.has(user_id)){

        projectService.getUser(user_id)
        .catch(error => {
          console.error(error);
          toast.add({ severity: 'error', summary: 'Error', detail: error, life: 3000 });
        })
        .then(result => {
          const [errorU, dataU] = result;
          cacheUser.set(user_id, dataU.name);
          activitie.attributes.username = dataU.name;
        });

      } else {
        activitie.attributes.username = cacheUser.get(user_id);
      }
    });
  });
};
watchEffect(refresh);

// Events
</script>

<template>
  <Card>
    <template #title v-if="false">Manage Version</template>
    <template #content>
      <DataTable :value="activities" dataKey="id"
            resizableColumns columnResizeMode="fit"
            sortField="number" :sortOrder="-1" :defaultSortOrder="-1"

            :paginator="true" :rows="10" :rowsPerPageOptions="[5, 10, 20, 50]"
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
            <h4 class="m-0">Activities History</h4>
          </div>
        </template>
        <template #empty> No Activities found. </template>
        <template #loading> Loading activities data. Please wait. </template>
        <Column field="attributes.created_at" header="Date (UTC)" style="width: 10%">
          <template #body="slotProps">
            <span>{{ $d(slotProps.data.attributes.created_at, 'long') }}</span>
          </template>
        </Column>
        <Column field="attributes.description" header="Event" style="width: 30%" />
        <Column field="attributes.username" header="User" style="width: 10%" />
      </DataTable>
    </template>
  </Card>
</template>

