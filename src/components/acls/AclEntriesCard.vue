<script setup lang="ts">
import { ref, watchEffect, type PropType } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable, { type DataTableRowEditSaveEvent } from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';

import type AclEntity from './acl.interface';
import type AclItemEntity from './acl.interface';


// Init
const emit = defineEmits(['update:visible']);
const toast = useToast();
const props = defineProps({
  acl_data: {
    type: Object as PropType<AclEntity>,
    resuired: true,
  },
  acl_state_dialog: {
    type: Boolean,
    resuired: true,
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

function refresh() {
  console.log('Load ACL entity!');

  //TODO call remove API
  if (props.acl_data === undefined || Object.keys(props.acl_data).length === 0) {
    headerTitle.value = 'Add ACL';
  } else {
    headerTitle.value = 'Edit ACL';
    //TODO if need a copy : const clone = JSON.parse(JSON.stringify(props.acl_data?.entries));
    entries.value = props.acl_data.entries;
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

function onRowEditSave(event: DataTableRowEditSaveEvent) {
  const { newData, index } = event;
  entries.value[index] = newData;
}

function saveACL() {
  //TODO Save by API
  // saveACL(acl

  // if (true) {
  closeModal(true);
  toast.add({ severity: 'success', summary: 'Successful', detail: 'Acl Created', life: 3000 });
  // }
}

function addIp() {
  const finded = entries.value.find((entrie: AclItemEntity) => {
    return entrie.ip == '0.0.0.0';
  });

  if (!finded) {
    const newRow = { id: idCounter.value--, ip: '0.0.0.0', comment: 'Add by FastSun' } as never;
    entries.value.unshift(newRow);
    editingRows.value = [...editingRows.value, newRow];
  }
}

function confirmDeleteAclEntry(index: number) {
  const ip = entries.value[index];
  console.log('Delete Ip (check) : ' + ip.id);

  ip_selected.value = ip;
  openIpDeleteModal();
}

function deleteIp() {
  if (ip_selected.value != null) {
    console.log('Delete domain (make) :' + ip_selected.value.ip);

    entries.value = entries.value.filter((val) => val.id !== ip_selected.value!.id);
    closeIpDeleteModal();
  }
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
        id="name"
        v-model.trim="acl_data!.name"
        required="true"
        autofocus
        :invalid="submitted && !acl_data!.name"
        fluid
      />
      <small v-if="submitted && !acl_data!.name" class="text-red-500">Name is required.</small>
    </div>
    <br />
    <div>
      <DataTable
        :value="entries"
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
        <Column field="comment" header="Comment" sortable>
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
              @click="confirmDeleteAclEntry(index)"
            />
          </template>
          <template #editor="{ editorSaveCallback, editorCancelCallback }">
            <Button icon="pi pi-save" text rounded @click="editorSaveCallback" />
            <Button
              icon="pi pi-times"
              text
              rounded
              severity="danger"
              @click="editorCancelCallback"
            />
          </template>
        </Column>
      </DataTable>
    </div>
    <template #footer>
      <Button label="Cancel" icon="pi pi-times" text @click="closeModal(false)" />
      <Button label="Save" icon="pi pi-check" @click="saveACL" />
    </template>
  </Dialog>

  <Dialog
    v-model:visible="deleteIpDialog"
    :style="{ width: '450px' }"
    header="Confirm"
    :modal="true"
  >
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
