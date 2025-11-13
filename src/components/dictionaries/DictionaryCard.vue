<script setup lang="ts">
import { ref, toRaw, watchEffect } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Card from 'primevue/card';
import ProgressSpinner from 'primevue/progressspinner';

import DictionaryItemsCard from './DictionaryItemsCard.vue';
import DictionaryAPIService from './dictionary.service';
import VclAPIService from '../vcl/vcl.service';
import { useCredentialsStore } from '@/stores/credentialsStore';
import type DictionaryEntity from './dictionary.interface';
import type DictionaryItemEntity from './dictionary.interface';
import { eventBus, EventType } from '@/utils/eventBus';

// Init
const toast = useToast();
const credentialsStore = useCredentialsStore();
const props = defineProps({
  vcl_version: {
    type: Number,
    required: true,
  },
});

// Data
const dictionaries = ref<DictionaryEntity[]>([]);
const dictionary_selected = ref<DictionaryEntity>();
const deleteDictionaryDialog = ref<boolean>(false);
const editDictionaryDialog = ref<boolean>(false);
const isDeleting = ref<boolean>(false);

function refresh() {
  console.log('FastSun > Refresh Dictionaries!');
  const dictionaryService = new DictionaryAPIService(
    credentialsStore.getServiceId(),
    credentialsStore.getServiceToken(),
  );

  dictionaryService
    .getDictionaries(props.vcl_version!)
    .then((result) => {
      dictionaries.value = result;
      cleanSelected();

      if (import.meta.env.DEV) {
        //DEBUG
        dictionaries.value.forEach((dict) => {
          console.log(toRaw(dict));
        });
      }

      // If no dictionaries exist, display an informational message
      if (dictionaries.value.length === 0) {
        console.log('FastSun > No dictionaries found, user can create a new one');
      }

      dictionaries.value.forEach((dict: DictionaryEntity) => {
        dictionaryService
          .getDictionaryItems(dict.id)
          .then((result) => {
            dict.items = result;
          })
          .catch((error) => {
            toast.add({ severity: 'error', summary: 'Error', detail: error, life: 5000 });
          });
      });
    })
    .catch((error) => {
      toast.add({ severity: 'error', summary: 'Error', detail: error, life: 5000 });
    });
}
watchEffect(refresh);

// Events
function cleanSelected() {
  dictionary_selected.value = {} as DictionaryEntity;
  dictionary_selected.value.items = [] as DictionaryItemEntity[];
}
function setSelected(dict: DictionaryEntity) {
  dictionary_selected.value = dict;
}

function openDictionaryEditModal() {
  editDictionaryDialog.value = true;
}
function closeDictionaryEditModal(updated: boolean) {
  editDictionaryDialog.value = false;
  cleanSelected();
  // Refresh is handled by watch on props.vcl_version, no need to call it here
}

function openDictionaryDeleteModal() {
  deleteDictionaryDialog.value = true;
}
function closeDictionaryDeleteModal() {
  deleteDictionaryDialog.value = false;
  cleanSelected();
}

function addDictionary() {
  console.log('FastSun > Add Dictionary!');

  const tempDict: DictionaryEntity = {
    id: '', // Empty ID for a new dictionary
    name: '',
    write_only: false,
    items: [] as DictionaryItemEntity[],
    service_id: credentialsStore.getServiceId(),
  } as DictionaryEntity;

  setSelected(tempDict);
  openDictionaryEditModal();
}

function editDictionary(dict: DictionaryEntity) {
  console.log('FastSun > Edit Dictionary: ' + dict.id);

  const clone = JSON.parse(JSON.stringify(dict));
  setSelected(clone);
  openDictionaryEditModal();
}

function confirmDeleteDictionary(dict: DictionaryEntity) {
  console.log('FastSun > Delete Dictionary: (check): ' + dict.name);

  setSelected(dict);
  openDictionaryDeleteModal();
}
async function deleteDictionary() {
  if (dictionary_selected.value) {
    const dictionaryName = dictionary_selected.value.name; // Save the name before deletion for the notification toast
    console.log('FastSun > Delete Dictionary (make): ' + dictionaryName);

    isDeleting.value = true;
    try {
      // Create a new draft version for deletion
      const vclService = new VclAPIService(credentialsStore.getServiceId(), credentialsStore.getServiceToken());
      const newVersion = await vclService.cloneVersion(props.vcl_version!.toString());

      // Delete the dictionary in the new version using the name
      const dictionaryService = new DictionaryAPIService(
        credentialsStore.getServiceId(),
        credentialsStore.getServiceToken(),
      );
      await dictionaryService.deleteDictionary(parseInt(newVersion.number), dictionaryName);

      // Validate the new VCL version
      console.log('FastSun > Validating VCL version:', newVersion.number);
      await vclService.validate(newVersion.number);

      // Activate the new VCL version
      console.log('FastSun > Activating VCL version:', newVersion.number);
      await vclService.activate(newVersion.number);

      // Update the VCL version in the store and notify other components
      credentialsStore.setVclVersion(parseInt(newVersion.number));
      eventBus.emit(EventType.VCL_VERSION_CHANGED, parseInt(newVersion.number));

      // Remove locally from the list
      dictionaries.value = dictionaries.value.filter((val: DictionaryEntity) => val.id !== dictionary_selected.value!.id);
      closeDictionaryDeleteModal();

      toast.add({
        severity: 'success',
        summary: 'Dictionary Deleted & Activated!',
        detail: `Dictionary "${dictionaryName}" deleted and version ${newVersion.number} activated`,
        life: 5000,
      });
    } catch (error) {
      console.error('Error deleting dictionary:', error);
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to delete dictionary. Please try again.',
        life: 5000,
      });
    } finally {
      isDeleting.value = false;
      closeDictionaryDeleteModal();
    }
  }
}
</script>

<template>
  <Card>
    <template #title v-if="false">Dictionaries</template>
    <template #content>
      <DataTable
        :value="dictionaries"
        dataKey="id"
        stripedRows
        resizableColumns
        columnResizeMode="fit"
        sortField="updated_at"
        :sortOrder="-1"
        :paginator="true"
        :rows="5"
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
            <h4 class="m-0" style="display: inline-flex">Manage Dictionaries</h4>
            <Button
              label="Add"
              icon="pi pi-plus"
              size="small"
              class="mr-2"
              style="margin-left: auto"
              @click="addDictionary()"
            />
          </div>
        </template>
        <template #empty> No dictionaries found. </template>
        <template #loading> Loading dictionaries data. Please wait. </template>
        <Column field="name" header="Name" sortable></Column>
        <Column field="write_only" header="Write Only" sortable>
          <template #body="slotProps">
            <span>{{ slotProps.data.write_only ? 'Yes' : 'No' }}</span>
          </template>
        </Column>
        <Column field="created_at" header="Created at (UTC)" sortable>
          <template #body="slotProps">
            <span>{{ $d(slotProps.data.created_at, 'long') }}</span>
          </template>
        </Column>
        <Column field="updated_at" header="Updated at (UTC)" sortable>
          <template #body="slotProps">
            <span>{{ $d(slotProps.data.updated_at, 'long') }}</span>
          </template>
        </Column>
        <Column :exportable="false" style="min-width: 8rem" header="Actions">
          <template #body="slotProps">
            <Button icon="pi pi-pencil" outlined rounded class="mr-2" @click="editDictionary(slotProps.data)" />
            <Button
              icon="pi pi-trash"
              outlined
              rounded
              severity="danger"
              @click="confirmDeleteDictionary(slotProps.data)"
            />
          </template>
        </Column>
      </DataTable>
    </template>
  </Card>

  <DictionaryItemsCard
    v-if="editDictionaryDialog && dictionary_selected"
    :dictionary_data="dictionary_selected"
    :dictionary_state_dialog="editDictionaryDialog"
    @update:visible="closeDictionaryEditModal"
  />

  <Dialog v-model:visible="deleteDictionaryDialog" :style="{ width: '450px' }" header="Confirm" :modal="true">
    <div v-if="!isDeleting" class="flex items-center gap-4">
      <i class="pi pi-exclamation-triangle !text-3xl" />
      <span v-if="dictionary_selected"
        >Are you sure you want to delete <b>{{ dictionary_selected.name }}</b
        >?</span
      >
    </div>
    <div v-else class="flex flex-col items-center gap-4 p-4">
      <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
      <p class="text-center">
        Deleting dictionary and activating new version...
        <br />
        <small class="text-gray-500">This may take a few seconds</small>
      </p>
    </div>
    <template #footer v-if="!isDeleting">
      <Button label="No" icon="pi pi-times" text @click="deleteDictionaryDialog = false" />
      <Button label="Yes" icon="pi pi-check" @click="deleteDictionary" />
    </template>
  </Dialog>
</template>
