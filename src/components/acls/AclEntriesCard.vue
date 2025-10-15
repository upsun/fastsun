<script setup lang="ts">
import { computed, ref, toRaw, watchEffect, nextTick, type PropType } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable, { type DataTableRowEditSaveEvent } from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import ProgressSpinner from 'primevue/progressspinner';

import type AclEntity from './acl.interface';
import type AclItemEntity from './acl.interface';
import AclAPIService from './acl.service';
import VclAPIService from '../vcl/vcl.service';
import { useCredentialsStore } from '@/stores/credentialsStore';
import LocalStore from '@/stores/localStorage';
import { eventBus, EventType } from '@/utils/eventBus';

// Init
const emit = defineEmits(['update:visible']);
const toast = useToast();
const credentialsStore = useCredentialsStore();
const props = defineProps({
  acl_data: {
    type: Object as PropType<AclEntity>,
    resuired: true,
  },
  acl_state_dialog: {
    type: Boolean,
    required: true,
  },
});

// Data
const submitted = ref<boolean>(false);
const headerTitle = ref<string>('ACL');
const entries = ref<AclItemEntity[]>([]);
const ip_selected = ref<AclItemEntity>();
const deleteIpDialog = ref<boolean>(false);
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
  console.log('FastSun > Load ACL: ' + props.acl_data!.id);

  if (props.acl_data === undefined || Object.keys(props.acl_data).length === 0) {
    headerTitle.value = 'Add ACL';
  } else {
    headerTitle.value = 'Edit ACL';
    entries.value = JSON.parse(JSON.stringify(props.acl_data.entries));
  }
}
watchEffect(refresh);

// Events
function closeModal(updated = false) {
  emit('update:visible', updated);
}

function openIpDeleteModal() {
  deleteIpDialog.value = true;
}
function closeIpDeleteModal() {
  deleteIpDialog.value = false;
  ip_selected.value = {} as AclItemEntity;
}

function isEdited(oldData: AclItemEntity, newData: AclItemEntity): boolean {
  return oldData.ip != newData.ip || oldData.subnet != newData.subnet || oldData.comment != newData.comment;
}

function onRowEditSave(event: DataTableRowEditSaveEvent) {
  const { data, newData, index } = event;

  if (isEdited(data, newData)) {
    entries.value[index] = newData;

    if (data.op == undefined || data.op == '') {
      newData.op = 'update';
    }
  }
}

async function saveACL() {
  console.log('FastSun > Save ACL: ' + props.acl_data!.id);
  submitted.value = true;

  // Dynamic name validation
  if (!validateName()) {
    focusNameInput();
    return;
  }

  // Check if this is a new ACL (ID is empty or undefined)
  const isNewAcl = !props.acl_data!.id || props.acl_data!.id === '';

  if (isNewAcl) {
    await createNewAcl();
  } else {
    await updateAclEntries();
  }
}

async function createNewAcl() {
  isSaving.value = true;
  try {
    console.log('FastSun > Creating new ACL with draft version...');

    // Step 1: Create a new draft VCL version
    const vclService = new VclAPIService(credentialsStore.getServiceId(), credentialsStore.getServiceToken());
    const newVersion = await vclService.cloneVersion(currentVclVersion.toString());

    console.log('FastSun > New draft version created:', newVersion.number);

    // Step 2: Create the ACL in the new version
    const aclService = new AclAPIService(credentialsStore.getServiceId(), credentialsStore.getServiceToken());
    const cleanedName = props.acl_data!.name.trim(); // Ensure the name is clean
    const newAcl = await aclService.createACL(parseInt(newVersion.number), cleanedName);

    console.log('FastSun > New ACL created:', newAcl.id);

    // Step 3: Update the entries if there are any
    const updated = entries.value.filter((entrie: AclItemEntity) => {
      return entrie.op != undefined && entrie.op != '';
    });

    if (updated.length > 0) {
      await aclService.updateAclEntry(newAcl.id, toRaw(updated));
      console.log('FastSun > ACL entries updated');
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
      summary: 'ACL Created & Activated!',
      detail: `ACL "${props.acl_data!.name}" created and version ${newVersion.number} activated`,
      life: 5000,
    });
  } catch (error) {
    console.error('Error creating ACL:', error);
    toast.add({
      severity: 'error',
      summary: 'Error Creating ACL',
      detail: error instanceof Error ? error.message : String(error),
      life: 5000,
    });
  } finally {
    isSaving.value = false;
  }
}

function updateAclEntries() {
  console.log('FastSun > Save ACL entries: ' + props.acl_data!.id);

  // Only item to update
  const updated = entries.value.filter((entrie: AclItemEntity) => {
    return entrie.op != undefined && entrie.op != '';
  });

  // Call API for entry https://www.fastly.com/documentation/reference/api/acls/acl-entry/#bulk-update-acl-entries
  if (updated.length > 0) {
    const aclApi = new AclAPIService(props.acl_data!.service_id, credentialsStore.getServiceToken());

    aclApi
      .updateAclEntry(props.acl_data!.id, toRaw(updated))
      .then(() => {
        closeModal(true);
        toast.add({
          severity: 'success',
          summary: 'ACL saved!',
          detail: 'ACL entries updated successfully',
          life: 5000,
        });
      })
      .catch((error) => {
        console.error('Error updating ACL entries:', error);
        toast.add({ severity: 'error', summary: 'Error updating ACL', detail: error.message || error, life: 5000 });
      });
  } else {
    // No entries to update, just close
    closeModal(true);
    toast.add({ severity: 'success', summary: 'ACL saved!', detail: 'ACL configuration saved', life: 5000 });
  }
}

function addIp() {
  const finded = entries.value.find((entrie: AclItemEntity) => {
    return entrie.ip == '0.0.0.0';
  });

  if (!finded) {
    const newRow = {
      id: idCounter.value--,
      ip: '8.8.8.8',
      subnet: '32',
      comment: 'Add by FastSun',
      op: 'create',
    } as never;
    entries.value.unshift(newRow);
    editingRows.value = [...editingRows.value, newRow];
  }
}

function confirmDeleteAclEntry(index: number) {
  const ipEntity = displayEntries.value[index];
  if (ipEntity) {
    console.log('FastSun > Delete IP (check): ' + ipEntity.id);

    ip_selected.value = ipEntity;
    openIpDeleteModal();
  }
}

function deleteIp() {
  if (ip_selected.value != null) {
    console.log('FastSun > Delete IP (make): ' + ip_selected.value.id);

    ip_selected.value.op = 'delete';
    closeIpDeleteModal();
  }
}

const displayEntries = computed(() => {
  return entries.value.filter((item) => {
    return item.op != 'delete';
  });
});

// Dynamic name validation
function validateName() {
  const name = props.acl_data!.name?.trim() || '';

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
    v-bind:visible="acl_state_dialog"
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
        v-model.trim="acl_data!.name"
        required="true"
        autofocus
        :invalid="!isNameValid"
        fluid
        placeholder="e.g. my_acl_name or My ACL Name"
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
    <div>
      <DataTable
        :value="displayEntries"
        dataKey="id"
        scrollable
        scrollHeight="400px"
        editMode="row"
        v-model:editingRows="editingRows"
        @row-edit-save="onRowEditSave"
      >
        <template #empty> No IPs defined. </template>
        <template #loading> Loading IPs data. Please wait...</template>
        <template #header>
          <div class="flex flex-wrap gap-2 items-center justify-between">
            <h4 class="m-0" style="display: inline-flex">Manage IPs</h4>
            <Button
              label="Add"
              icon="pi pi-plus"
              size="small"
              class="mr-2"
              style="margin-left: auto"
              @click="addIp()"
            />
          </div>
        </template>
        <Column field="ip" header="IP" sortable>
          <template #editor="{ data, field }">
            <InputText v-model="data[field]" fluid />
          </template>
        </Column>
        <Column field="subnet" header="Subnet" sortable style="width: 25%">
          <template #editor="{ data, field }">
            <InputText v-model="data[field]" fluid />
          </template>
        </Column>
        <Column field="comment" header="Comment" sortable>
          <template #editor="{ data, field }">
            <InputText v-model="data[field]" fluid />
          </template>
        </Column>
        <Column :exportable="false" style="min-width: 8rem" header="Actions">
          <template #body="{ editorInitCallback, index }">
            <Button icon="pi pi-pencil" outlined rounded class="mr-2" @click="editorInitCallback" />
            <Button icon="pi pi-trash" outlined rounded severity="danger" @click="confirmDeleteAclEntry(index)" />
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
      <Button label="Save" icon="pi pi-check" @click="saveACL" />
    </template>
    <div v-if="isSaving" class="flex items-center justify-center gap-2 p-4">
      <ProgressSpinner style="width: 30px; height: 30px" strokeWidth="4" />
      <span>Creating ACL and activating version...</span>
    </div>
  </Dialog>

  <Dialog v-model:visible="deleteIpDialog" :style="{ width: '450px' }" header="Confirm" :modal="true">
    <div class="flex items-center gap-4">
      <i class="pi pi-exclamation-triangle !text-3xl" />
      <span v-if="ip_selected"
        >Are you sure you want to delete <b>{{ ip_selected.ip }}</b
        >?</span
      >
    </div>
    <template #footer>
      <Button label="No" icon="pi pi-times" text @click="deleteIpDialog = false" />
      <Button label="Yes" icon="pi pi-check" @click="deleteIp" />
    </template>
  </Dialog>
</template>
