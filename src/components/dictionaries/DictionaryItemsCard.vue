<script setup lang="ts">
import { computed, ref, toRaw, watchEffect, nextTick, type PropType } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable, { type DataTableRowEditSaveEvent } from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Checkbox from 'primevue/checkbox';
import ProgressSpinner from 'primevue/progressspinner';

import type { DictionaryEntity, DictionaryItemEntity } from './dictionary.interface';
import DictionaryAPIService from './dictionary.service';
import VclAPIService from '../vcl/vcl.service';
import { useCredentialsStore } from '@/stores/credentialsStore';
import LocalStore from '@/stores/localStorage';
import { eventBus, EventType } from '@/utils/eventBus';

// Init
const emit = defineEmits(['update:visible']);
const toast = useToast();
const credentialsStore = useCredentialsStore();
const props = defineProps({
  dictionary_data: {
    type: Object as PropType<DictionaryEntity>,
    required: true,
  },
  dictionary_state_dialog: {
    type: Boolean,
    required: true,
  },
});

// Data
const submitted = ref<boolean>(false);
const headerTitle = ref<string>('Dictionary');
const items = ref<DictionaryItemEntity[]>([]);
const item_selected = ref<DictionaryItemEntity>();
const deleteItemDialog = ref<boolean>(false);
const editingRows = ref([]);
const idCounter = ref<number>(-1);

// Dynamic name validation
const nameInputRef = ref<HTMLInputElement>();
const nameError = ref<string>('');
const isNameValid = ref<boolean>(true);
const isSaving = ref<boolean>(false);

// We need to retrieve the current VCL version from the credentialsStore
const currentVclVersion = credentialsStore.getVclVersion();

const localStore = new LocalStore();
function refresh() {
  console.log('FastSun > Load Dictionary: ' + props.dictionary_data!.id);

  if (props.dictionary_data === undefined || Object.keys(props.dictionary_data).length === 0) {
    headerTitle.value = 'Add Dictionary';
  } else {
    headerTitle.value = 'Edit Dictionary';
    items.value = JSON.parse(JSON.stringify(props.dictionary_data.items));
  }
}
watchEffect(refresh);

// Events
function closeModal(updated = false) {
  emit('update:visible', updated);
}

function openItemDeleteModal() {
  deleteItemDialog.value = true;
}
function closeItemDeleteModal() {
  deleteItemDialog.value = false;
  item_selected.value = {} as DictionaryItemEntity;
}

function isEdited(oldData: DictionaryItemEntity, newData: DictionaryItemEntity): boolean {
  return oldData.item_key != newData.item_key || oldData.item_value != newData.item_value;
}

function onRowEditSave(event: DataTableRowEditSaveEvent) {
  const { data, newData, index } = event;

  if (isEdited(data, newData)) {
    items.value[index] = newData;

    if (data.op === undefined || data.op === '') {
      newData.op = 'update';
    }
  }
}

async function saveDictionary() {
  console.log('FastSun > Save Dictionary: ' + props.dictionary_data!.id);
  submitted.value = true;

  // Dynamic name validation
  if (!validateName()) {
    focusNameInput();
    return;
  }

  // Check if this is a new dictionary (ID is empty or undefined)
  const isNewDictionary = !props.dictionary_data!.id || props.dictionary_data!.id === '';

  if (isNewDictionary) {
    await createNewDictionary();
  } else {
    await updateDictionaryItems();
  }
}

async function createNewDictionary() {
  isSaving.value = true;
  try {
    console.log('FastSun > Creating new Dictionary with draft version...');

    // Step 1: Create a new draft VCL version
    const vclService = new VclAPIService(credentialsStore.getServiceId(), credentialsStore.getServiceToken());
    const newVersion = await vclService.cloneVersion(currentVclVersion.toString());

    console.log('FastSun > New draft version created:', newVersion.number);

    // Step 2: Create the dictionary in the new version
    const dictionaryService = new DictionaryAPIService(
      credentialsStore.getServiceId(),
      credentialsStore.getServiceToken(),
    );
    const cleanedName = props.dictionary_data!.name.trim(); // Ensure the name is clean
    const newDictionary = await dictionaryService.createDictionary(
      parseInt(newVersion.number),
      cleanedName,
      props.dictionary_data!.write_only,
    );

    console.log('FastSun > New Dictionary created:', newDictionary.id);

    // Step 3: Update the items if there are any
    const updated = items.value.filter((item: DictionaryItemEntity) => {
      return item.op !== undefined && item.op !== '';
    });

    if (updated.length > 0) {
      await dictionaryService.updateDictionaryItems(newDictionary.id, toRaw(updated));
      console.log('FastSun > Dictionary items updated');
    }

    // Step 4: Validate the new VCL version
    console.log('FastSun > Validating VCL version:', newVersion.number);
    await vclService.validate(newVersion.number);

    // Step 5: Activate the new VCL version
    console.log('FastSun > Activating VCL version:', newVersion.number);
    await vclService.activate(newVersion.number);

    // Step 6: Close modal first, then update the VCL version in the store and notify other components
    closeModal(true);

    credentialsStore.setVclVersion(parseInt(newVersion.number));
    eventBus.emit(EventType.VCL_VERSION_CHANGED, parseInt(newVersion.number));

    toast.add({
      severity: 'success',
      summary: 'Dictionary Created & Activated!',
      detail: `Dictionary "${props.dictionary_data!.name}" created and version ${newVersion.number} activated`,
      life: 5000,
    });
  } catch (error) {
    console.error('Error creating dictionary:', error);
    toast.add({
      severity: 'error',
      summary: 'Error Creating Dictionary',
      detail: error instanceof Error ? error.message : String(error),
      life: 5000,
    });
  } finally {
    isSaving.value = false;
  }
}

function updateDictionaryItems() {
  console.log('FastSun > Save Dictionary items: ' + props.dictionary_data!.id);

  // Only items to update
  const updated = items.value.filter((item: DictionaryItemEntity) => {
    return item.op !== undefined && item.op !== '';
  });

  // Call API for items
  if (updated.length > 0) {
    const dictionaryApi = new DictionaryAPIService(
      props.dictionary_data!.service_id,
      credentialsStore.getServiceToken(),
    );

    dictionaryApi
      .updateDictionaryItems(props.dictionary_data!.id, toRaw(updated))
      .then(() => {
        closeModal(true);
        toast.add({
          severity: 'success',
          summary: 'Dictionary saved!',
          detail: 'Dictionary items updated successfully',
          life: 5000,
        });
      })
      .catch((error) => {
        console.error('Error updating dictionary items:', error);
        toast.add({
          severity: 'error',
          summary: 'Error updating dictionary',
          detail: error.message || error,
          life: 5000,
        });
      });
  } else {
    // No items to update, just close
    closeModal(true);
    toast.add({
      severity: 'success',
      summary: 'Dictionary saved!',
      detail: 'Dictionary configuration saved',
      life: 5000,
    });
  }
}

function addItem() {
  const newRow = {
    id: idCounter.value--,
    item_key: 'new_key',
    item_value: 'new_value',
    op: 'create',
  } as never;
  items.value.unshift(newRow);
  editingRows.value = [...editingRows.value, newRow];
}

function confirmDeleteDictionaryItem(index: number) {
  const itemEntity = displayItems.value[index];
  if (itemEntity) {
    console.log('FastSun > Delete Item (check): ' + itemEntity.id);

    item_selected.value = itemEntity;
    openItemDeleteModal();
  }
}

function deleteItem() {
  if (item_selected.value != null) {
    console.log('FastSun > Delete Item (make): ' + item_selected.value.id);

    item_selected.value.op = 'delete';
    closeItemDeleteModal();
  }
}

const displayItems = computed(() => {
  return items.value.filter((item) => {
    return item.op !== 'delete';
  });
});

// Dynamic name validation
function validateName() {
  const name = props.dictionary_data!.name?.trim() || '';

  if (!name) {
    nameError.value = 'Name is required';
    isNameValid.value = false;
    return false;
  }

  const namePattern = /^[a-zA-Z][a-zA-Z0-9_\s]*$/;
  if (!namePattern.test(name)) {
    nameError.value = 'Name must start with a letter and contain only letters, numbers, underscores, and spaces';
    isNameValid.value = false;
    return false;
  }

  nameError.value = '';
  isNameValid.value = true;
  return true;
}

// Handler for real-time input
function onNameInput() {
  validateName();
}

// Focus on the name field with error
function focusNameInput() {
  nextTick(() => {
    if (nameInputRef.value) {
      nameInputRef.value.focus();
    }
  });
}
</script>

<template>
  <Dialog
    v-bind:visible="dictionary_state_dialog"
    @update:visible="closeModal"
    :style="{ width: '900px' }"
    v-bind:header="headerTitle"
    :modal="true"
  >
    <div>
      <label for="name" class="block font-bold mb-3">Name</label>
      <InputText
        ref="nameInputRef"
        id="name"
        v-model.trim="dictionary_data!.name"
        required="true"
        autofocus
        :invalid="!isNameValid"
        fluid
        placeholder="e.g. my_dictionary_name or My Dictionary Name"
        @input="onNameInput"
        @blur="validateName"
        :class="{ 'border-red-500 bg-red-50': !isNameValid }"
      />
      <small v-if="nameError" class="text-red-500 block mt-1">{{ nameError }}</small>
      <small v-else class="text-gray-500 text-sm mt-1 block">
        Must start with a letter and contain only letters, numbers, underscores, and spaces
      </small>
    </div>
    <br />
    <div class="flex items-center gap-2 mb-4">
      <Checkbox v-model="dictionary_data!.write_only" :binary="true" inputId="write_only" />
      <label for="write_only" class="cursor-pointer">Write-only (items are not readable)</label>
    </div>
    <div>
      <DataTable
        :value="displayItems"
        dataKey="id"
        scrollable
        scrollHeight="400px"
        editMode="row"
        v-model:editingRows="editingRows"
        @row-edit-save="onRowEditSave"
      >
        <template #empty> No items defined. </template>
        <template #loading> Loading dictionary items. Please wait...</template>
        <template #header>
          <div class="flex flex-wrap gap-2 items-center justify-between">
            <h4 class="m-0" style="display: inline-flex">Manage Items</h4>
            <Button
              label="Add"
              icon="pi pi-plus"
              size="small"
              class="mr-2"
              style="margin-left: auto"
              @click="addItem()"
            />
          </div>
        </template>
        <Column field="item_key" header="Key" sortable>
          <template #editor="{ data, field }">
            <InputText v-model="data[field]" fluid />
          </template>
        </Column>
        <Column field="item_value" header="Value" sortable>
          <template #editor="{ data, field }">
            <InputText v-model="data[field]" fluid />
          </template>
        </Column>
        <Column :exportable="false" style="min-width: 8rem" header="Actions">
          <template #body="{ editorInitCallback, index }">
            <Button icon="pi pi-pencil" outlined rounded class="mr-2" @click="editorInitCallback" />
            <Button
              icon="pi pi-trash"
              outlined
              rounded
              severity="danger"
              @click="confirmDeleteDictionaryItem(index)"
            />
          </template>
          <template #editor="{ editorSaveCallback, editorCancelCallback }">
            <Button icon="pi pi-save" text rounded @click="editorSaveCallback" />
            <Button icon="pi pi-times" text rounded severity="danger" @click="editorCancelCallback" />
          </template>
        </Column>
      </DataTable>
    </div>
    <template #footer v-if="!isSaving">
      <Button label="Cancel" icon="pi pi-times" text @click="closeModal(false)" />
      <Button label="Save" icon="pi pi-check" @click="saveDictionary" />
    </template>
    <div v-if="isSaving" class="flex items-center justify-center gap-2 p-4">
      <ProgressSpinner style="width: 30px; height: 30px" strokeWidth="4" />
      <span>Creating dictionary and activating version...</span>
    </div>
  </Dialog>

  <Dialog v-model:visible="deleteItemDialog" :style="{ width: '450px' }" header="Confirm" :modal="true">
    <div class="flex items-center gap-4">
      <i class="pi pi-exclamation-triangle !text-3xl" />
      <span v-if="item_selected"
        >Are you sure you want to delete <b>{{ item_selected.item_key }}</b
        >?</span
      >
    </div>
    <template #footer>
      <Button label="No" icon="pi pi-times" text @click="deleteItemDialog = false" />
      <Button label="Yes" icon="pi pi-check" @click="deleteItem" />
    </template>
  </Dialog>
</template>
