<script setup lang="ts">
import { inject, onMounted, onBeforeUnmount, ref, toRaw, watchEffect } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import ProjectAPIService from './project.service';
import { eventBus, EventType } from '@/utils/eventBus';

import type ActivityEntity from './project.interface';
import UserCache from '@/stores/localStorage';
import ApiCache from '@/stores/localStorage';

// Init
const service_token = (new ApiCache()).getFastlyToken() || '';
const toast = useToast();
const props = defineProps({
  service_id: {
    type: String,
    required: true,
  },
});
const cache = new UserCache();

onMounted(() => {
  eventBus.on(EventType.LOG_REFRESH, refresh);
});

onBeforeUnmount(() => {
  eventBus.off(EventType.LOG_REFRESH);
});

// Data
const activities = ref<ActivityEntity[]>([]);

// Or use Computed()
function refresh() {
  console.log('Refresh Activities History!');
  const projectService = new ProjectAPIService(props.service_id!, service_token);

  projectService
    .getActivities()
    .then((result_act) => {
      activities.value = result_act;

      if (import.meta.env.DEV) {
        activities.value.forEach((activitie) => {
          console.log(toRaw(activitie));
        });
      }

      activities.value.forEach((activitie: ActivityEntity) => {
        const user_id = activitie.attributes.user_id;
        const userInCache = cache.getUser(user_id);

        if (!userInCache) {
          projectService
            .getUser(user_id)
            .then((result_user) => {
              cache.setUser(result_user);
              activitie.attributes.username = result_user.name;
            })
            .catch((error) => {
              toast.add({ severity: 'error', summary: 'Error', detail: error, life: 3000 });
            });
        } else {
          activitie.attributes.username = userInCache.name;
        }
      });
    })
    .catch((error) => {
      toast.add({ severity: 'error', summary: 'Error', detail: error, life: 3000 });
    });
}
watchEffect(refresh);

// Events
</script>

<template>
  <Card>
    <template #title v-if="false">Manage Version</template>
    <template #content>
      <DataTable
        :value="activities"
        dataKey="id"
        resizableColumns
        columnResizeMode="fit"
        sortField="number"
        :sortOrder="-1"
        :defaultSortOrder="-1"
        :paginator="true"
        :rows="10"
        :rowsPerPageOptions="[5, 10, 20, 50]"
        paginatorTemplate="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
        currentPageReportTemplate="{first} to {last} of {totalRecords}"
      >
        <template #paginatorstart>
          <Button type="button" icon="pi pi-refresh" text @click="refresh" />
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
