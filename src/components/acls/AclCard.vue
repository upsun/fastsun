<script setup lang="ts">
import { inject, ref, watchEffect } from 'vue'
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from "primevue/button";
import ConfirmDialog from 'primevue/confirmdialog';
import AclAPIService from '@/components/acls/acl.api';

const FASTLY_API_TOKEN = inject('FASTLY_API_TOKEN') as String;

const toast = useToast();
const props = defineProps({
  service_id: String,
  vcl_version: Number
});

const acls = ref([]);

watchEffect(async () => {
  const aclService = new AclAPIService(props.service_id!, FASTLY_API_TOKEN);
  const [error, data] = await aclService.getACL(props.vcl_version!);

  if (error) console.error(error);
  else acls.value = data;

  acls.value.forEach(acl => {
    console.log(acl);
  })

  acls.value.forEach( async (acl) => {
    const [error, data] = await aclService.getACLEntry(acl.id);

    if (error) {
      console.error(error);
      toast.add({ severity: 'error', summary: 'Error', detail: error, life: 1000 });
    } else {
      acl.entries = data;
    }
  });
})

function editAcl(acl: any) {
  console.log("Edit " + acl.id);
}

function confirmDeleteAcl(acl: any) {
  console.log("DELETE " + acl.id);
}


function onCellEditComplete() {}

function expandAll() {}

function collapseAll() {}

function onRowExpand() {}

function onRowCollapse() {}


</script>

<template>
  <Card>
    <template #title v-if="false">Acces Control List</template>
    <template #content>
  <!-- <Button label="Click me" /> -->
  <!-- <li v-for="acl in acls" :key="acl.id">
    {{ acl.name }}<br />
    [{{ acl.id }}]
    <li v-for="entry in acl.entries" :key="entry.id">
      {{ entry.ip }}
    </li>
  </li> -->
  <!-- <Toolbar class="mb-6">
    <template #start>
      <Button label="New" icon="pi pi-plus" class="mr-2" @click="openNew" />
      <Button label="Delete" icon="pi pi-trash" severity="danger" outlined @click="confirmDeleteSelected" :disabled="!selectedProducts || !selectedProducts.length" />
    </template>

    <template #end>
      <FileUpload mode="basic" accept="image/*" :maxFileSize="1000000" label="Import" customUpload chooseLabel="Import" class="mr-2" auto :chooseButtonProps="{ severity: 'secondary' }" />
      <Button label="Export" icon="pi pi-upload" severity="secondary" @click="exportCSV($event)" />
    </template>
  </Toolbar> -->
  <ConfirmDialog></ConfirmDialog>
  <DataTable :value="acls" dataKey="id"
        stripedRows

        resizableColumns columnResizeMode="fit"

        sortField="updated_at" :sortOrder="-1"

        :paginator="true" :rows="5" :rowsPerPageOptions="[5, 10, 20, 50]"
        paginatorTemplate="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
        currentPageReportTemplate="{first} to {last} of {totalRecords}"

        editMode="cell" @cell-edit-complete="onCellEditComplete"
        :pt="{
            table: { style: 'min-width: 50rem' },
            column: {
                bodycell: ({ state }) => ({
                    class: [{ '!py-0': state['d_editing'] }]
                })
            }
        }"


        >
        <!-- tableStyle="min-width: 50rem" v-model:expandedRows="expandedRows" @rowExpand="onRowExpand" @rowCollapse="onRowCollapse" -->
    <template #paginatorstart>
        <Button type="button" icon="pi pi-refresh" text />
    </template>
    <template #paginatorend>
        <Button type="button" icon="pi pi-download" text />
    </template>
    <template #header>
      <div class="flex flex-wrap gap-2 items-center justify-between">
            <h4 class="m-0" style="display: inline-flex;">Manage ACL</h4>
            <Button label="Add" icon="pi pi-plus" size="small" class="mr-2" style="margin-left: auto;" @click="AddAcl()" />
            <!-- <IconField>
                <InputIcon>
                    <i class="pi pi-search" />
                </InputIcon>
                <InputText v-model="filters['global'].value" placeholder="Search..." />
            </IconField> -->
            <!-- <div class="">
              <Button text icon="pi pi-plus" label="Expand All" @click="expandAll" />
              <Button text icon="pi pi-minus" label="Collapse All" @click="collapseAll" />
            </div> -->
        </div>
        <!-- <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-xl font-bold">Products</span>
            <Button icon="pi pi-refresh" rounded raised />
        </div> -->

    </template>
    <template #empty> No ACL found. </template>
    <template #loading> Loading ACLs data. Please wait. </template>
    <!-- <Column selectionMode="multiple" headerStyle="width: 3rem"></Column> -->
    <!-- <Column expander style="width: 5rem" /> -->
    <!-- <Column field="id" header="ID" sortable style="width: 25%"></Column> -->
    <Column field="name" header="Name" sortable></Column>
    <Column field="created_at" header="Created at" sortable></Column>
    <Column field="updated_at" header="Updated at" sortable></Column>
    <Column :exportable="false" style="min-width: 12rem" header="Actions">
        <template #body="slotProps">
            <Button icon="pi pi-pencil" outlined rounded class="mr-2" @click="editAcl(slotProps.data)" />
            <Button icon="pi pi-trash" outlined rounded severity="danger" @click="confirmDeleteAcl(slotProps.data)" />
        </template>
    </Column>
    <!-- <Column field="entries.data" header="Entity" sortable></Column> -->
    <!-- <template #expansion="slotProps">
        <div class="p-4">
            <h5>IPs for {{ slotProps.data.name }}</h5>
            <DataTable :value="slotProps.data.entries.data">
                <Column field="id" header="Id" sortable></Column>
                <Column field="customer" header="Customer" sortable></Column>
                <Column field="date" header="Date" sortable></Column>
                <Column field="amount" header="Amount" sortable>
                    <template #body="slotProps">
                        {{ formatCurrency(slotProps.data.amount) }}
                    </template>
                </Column>
                <Column field="status" header="Status" sortable>
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.status.toLowerCase()" :severity="getOrderSeverity(slotProps.data)" />
                    </template>
                </Column>
                <Column headerStyle="width:4rem">
                    <template #body>
                        <Button icon="pi pi-search" />
                    </template>
                </Column>
            </DataTable>
        </div>
    </template> -->
  </DataTable>
  </template>
  </Card>
</template>
