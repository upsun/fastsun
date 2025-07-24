<script setup lang="ts">
import { computed, ref, toRaw, watchEffect, type PropType } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable, { type DataTableRowEditSaveEvent } from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';

import type AclEntity from './acl.interface';
import type AclItemEntity from './acl.interface';
import AclAPIService from './acl.service';
import { useCredentialsStore } from '@/stores/credentialsStore';
import LocalStore from '@/stores/localStorage';

/**
 * SECURITY: Uses centralized credentials store instead of props to avoid token exposure
 */

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
    resuired: true,
  },
  is_admin: {
    type: Boolean,
    default() {
      return true;
    },
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

const localStore = new LocalStore();
function refresh() {
  console.log('FastSun > Load ACL: ' + props.acl_data!.id);

  //TODO call remove API
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

function saveACL() {
  console.log('FastSun > Save ACL: ' + props.acl_data!.id);
  //TODO Save by API the ACL (create/update)

  //// Update Entries.
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
        toast.add({ severity: 'success', summary: 'ACL created !', detail: 'Acl Created!\n', life: 5000 });
      })
      .catch((error) => {
        toast.add({ severity: 'error', summary: 'Error Create ACL', detail: error, life: 5000 });
      });
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
  console.log('FastSun > Delete IP (check): ' + ipEntity.id);

  ip_selected.value = ipEntity;
  openIpDeleteModal();
}

function deleteIp() {
  if (ip_selected.value != null) {
    console.log('FastSun > Delete IP (make): ' + ip_selected.value.id);
    //if (ip_selected.value.)
    //entries.value = entries.value.filter((val) => val.id !== ip_selected.value!.id);
    ip_selected.value.op = 'delete';
    closeIpDeleteModal();
  }
}

const displayEntries = computed(() => {
  return entries.value.filter((item) => {
    return item.op != 'delete';
  });
});
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
        :disabled="!is_admin"
        :invalid="submitted && !acl_data!.name"
        fluid
      />
      <small v-if="submitted && !acl_data!.name" class="text-red-500">Name is required.</small>
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
    <template #footer>
      <Button label="Cancel" icon="pi pi-times" text @click="closeModal(false)" />
      <Button label="Save" icon="pi pi-check" @click="saveACL" />
    </template>
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
