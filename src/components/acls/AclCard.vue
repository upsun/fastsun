<script setup lang="ts">
import { ref, toRaw, watchEffect } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Card from 'primevue/card';
import ProgressSpinner from 'primevue/progressspinner';

import AclEntriesCard from './AclEntriesCard.vue';
import AclAPIService from './acl.service';
import VclAPIService from '../vcl/vcl.service';
import { useCredentialsStore } from '@/stores/credentialsStore';
import type AclEntity from './acl.interface';
import type AclItemEntity from './acl.interface';
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
const acls = ref<AclEntity[]>([]);
const acl_selected = ref<AclEntity>();
const deleteAclDialog = ref<boolean>(false);
const editAclDialog = ref<boolean>(false);
const isDeleting = ref<boolean>(false);

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

      // If no ACL exists, display an informational message
      if (acls.value.length === 0) {
        console.log('FastSun > No ACLs found, user can create a new one');
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
  // Refresh is handled by watch on props.vcl_version, no need to call it here
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

  const tempAcl: AclEntity = {
    id: '', // Empty ID for a new ACL
    name: '',
    entries: [] as AclItemEntity[],
    service_id: credentialsStore.getServiceId(),
  } as AclEntity;

  setSelected(tempAcl);
  openAclEditModal();
}

function editAcl(acl: AclEntity) {
  console.log('FastSun > Edit ACL: ' + acl.id);

  const clone = JSON.parse(JSON.stringify(acl));
  setSelected(clone);
  openAclEditModal();
}

function confirmDeleteAcl(acl: AclEntity) {
  console.log('FastSun > Delete ACL: (check): ' + acl.name);

  setSelected(acl);
  openAclDeleteModal();
}
async function deleteAcl() {
  if (acl_selected.value) {
    const aclName = acl_selected.value.name; // Save the name before deletion for the notification toast
    console.log('FastSun > Delete ACL (make): ' + aclName);

    isDeleting.value = true;
    try {
      // Create a new draft version for deletion
      const vclService = new VclAPIService(credentialsStore.getServiceId(), credentialsStore.getServiceToken());
      const newVersion = await vclService.cloneVersion(props.vcl_version!.toString());

      // Delete the ACL in the new version using the name
      const aclService = new AclAPIService(credentialsStore.getServiceId(), credentialsStore.getServiceToken());
      await aclService.deleteACL(parseInt(newVersion.number), aclName);

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
      acls.value = acls.value.filter((val: AclEntity) => val.id !== acl_selected.value!.id);
      closeAclDeleteModal();

      toast.add({
        severity: 'success',
        summary: 'ACL Deleted & Activated!',
        detail: `ACL "${aclName}" deleted and version ${newVersion.number} activated`,
        life: 5000,
      });
    } catch (error) {
      console.error('Error deleting ACL:', error);
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to delete ACL. Please try again.',
        life: 5000,
      });
    } finally {
      isDeleting.value = false;
      closeAclDeleteModal();
    }
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
    <div v-if="!isDeleting" class="flex items-center gap-4">
      <i class="pi pi-exclamation-triangle !text-3xl" />
      <span v-if="acl_selected"
        >Are you sure you want to delete <b>{{ acl_selected.name }}</b
        >?</span
      >
    </div>
    <div v-else class="flex flex-col items-center gap-4 p-4">
      <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
      <p class="text-center">
        Deleting ACL and activating new version...
        <br />
        <small class="text-gray-500">This may take a few seconds</small>
      </p>
    </div>
    <template #footer v-if="!isDeleting">
      <Button label="No" icon="pi pi-times" text @click="deleteAclDialog = false" />
      <Button label="Yes" icon="pi pi-check" @click="deleteAcl" />
    </template>
  </Dialog>
</template>
