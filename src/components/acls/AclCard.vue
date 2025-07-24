<script setup lang="ts">
import { ref, toRaw, watchEffect } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Card from 'primevue/card';

import AclEntriesCard from './AclEntriesCard.vue';
import AclAPIService from './acl.service';
import { useCredentialsStore } from '@/stores/credentialsStore';
import type AclEntity from './acl.interface';
import type AclItemEntity from './acl.interface';

/**
 * SECURITY: Uses centralized credentials store instead of props to avoid token exposure
 */

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
const acls = ref<AclEntity[]>([]);
const acl_selected = ref<AclEntity>();
const deleteAclDialog = ref<boolean>(false);
const editAclDialog = ref<boolean>(false);

function refresh() {
  console.log('FastSun > Refresh ACL!');
  const aclService = new AclAPIService(credentialsStore.getServiceId(), credentialsStore.getServiceToken());

  aclService
    .getACL(props.vcl_version!)
    .then((result) => {
      acls.value = result;
      cleanSelected();

      if (import.meta.env.DEV) {
        //DEBUG
        acls.value.forEach((acl) => {
          console.log(toRaw(acl));
        });
      }

      acls.value.forEach((acl: AclEntity) => {
        aclService
          .getACLEntry(acl.id)
          .then((result) => {
            acl.entries = result;
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
  acl_selected.value = {} as AclEntity;
  acl_selected.value.entries = [] as AclItemEntity[];
}
function setSelected(acl: AclEntity) {
  acl_selected.value = acl;
}

function openAclEditModal() {
  editAclDialog.value = true;
}
function closeAclEditModal(updated: boolean) {
  editAclDialog.value = false;
  cleanSelected();
  if (updated) {
    refresh();
  }
}

function openAclDeleteModal() {
  deleteAclDialog.value = true;
}
function closeAclDeleteModal() {
  deleteAclDialog.value = false;
  cleanSelected();
}

function addAcl() {
  console.log('FastSun > Add ACL!');

  cleanSelected();
  openAclEditModal();
}

function editAcl(acl: AclEntity) {
  console.log('FastSun > Edit ACL: ' + acl.id);

  const clone = JSON.parse(JSON.stringify(acl));
  setSelected(clone);
  openAclEditModal();
}

function confirmDeleteAcl(acl: AclEntity) {
  console.log('FastSun > Delete ACL: (check): ' + acl.id);

  setSelected(acl);
  openAclDeleteModal();
}
function deleteAcl() {
  if (acl_selected.value) {
    console.log('FastSun > Delete ACL (make): ' + acl_selected.value.id);

    //TODO call remove API
    acls.value = acls.value.filter((val: AclEntity) => val.id !== acl_selected.value!.id);
    closeAclDeleteModal();

    toast.add({ severity: 'success', summary: 'Successful', detail: 'ACL Deleted', life: 5000 });
  }
}
</script>

<template>
  <Card>
    <template #title v-if="false">Acces Control List</template>
    <template #content>
      <DataTable
        :value="acls"
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
            <h4 class="m-0" style="display: inline-flex">Manage ACL</h4>
            <Button
              label="Add"
              icon="pi pi-plus"
              size="small"
              class="mr-2"
              style="margin-left: auto"
              @click="addAcl()"
            />
          </div>
        </template>
        <template #empty> No ACL found. </template>
        <template #loading> Loading ACLs data. Please wait. </template>
        <Column field="name" header="Name" sortable></Column>
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
            <Button icon="pi pi-pencil" outlined rounded class="mr-2" @click="editAcl(slotProps.data)" />
            <Button icon="pi pi-trash" outlined rounded severity="danger" @click="confirmDeleteAcl(slotProps.data)" />
          </template>
        </Column>
      </DataTable>
    </template>
  </Card>

  <AclEntriesCard
    v-if="editAclDialog"
    :acl_data="acl_selected"
    :acl_state_dialog="editAclDialog"
    @update:visible="closeAclEditModal"
  />

  <Dialog v-model:visible="deleteAclDialog" :style="{ width: '450px' }" header="Confirm" :modal="true">
    <div class="flex items-center gap-4">
      <i class="pi pi-exclamation-triangle !text-3xl" />
      <span v-if="acl_selected"
        >Are you sure you want to delete <b>{{ acl_selected.name }}</b
        >?</span
      >
    </div>
    <template #footer>
      <Button label="No" icon="pi pi-times" text @click="deleteAclDialog = false" />
      <Button label="Yes" icon="pi pi-check" @click="deleteAcl" />
    </template>
  </Dialog>
</template>
