<script setup lang="ts">
import { inject, ref, toRaw, watchEffect } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import { Form } from '@primevue/forms';
import InputText from 'primevue/inputtext';

// Init
const emit = defineEmits(["update:visible"]);
const toast = useToast();
const props = defineProps({
  acl_data: Object,
  acl_state_dialog: Boolean,
});

// Data
const submitted = ref(false);
const headerTitle = ref("ACL");

function refresh() {
  console.log("Load ACL entity!");

  if ((props.acl_data === undefined) || (Object.keys(props.acl_data).length === 0)) {
    headerTitle.value = "Add ACL";
  } else {
    headerTitle.value = "Edit ACL";
  }
};
watchEffect(refresh);

// Events
function closeModal(updated = false) {
  emit("update:visible", updated);
};

function saveACL() {
  //TODO Save by API
  // saveACL(acl

  if (true) {
    closeModal(true);
    toast.add({ severity: 'success', summary: 'Successful', detail: 'Product Created', life: 3000 });
  }
}
</script>

<template>
  <!-- <Form v-slot="$form" @submit="saveACL"  @submit.prevent="saveACL" class="flex flex-col gap-4 w-full sm:w-56"> -->
    <Dialog v-bind:visible="acl_state_dialog" @update:visible="closeModal" :style="{ width: '450px' }" :header="headerTitle" :modal="true" >
      <div>
        <label for="name" class="block font-bold mb-3">Name</label>
        <InputText id="name" v-model.trim="acl_data!.name" required="true" autofocus :invalid="submitted && !acl_data!.name" fluid />
        <small v-if="submitted && !acl_data!.name" class="text-red-500">Name is required.</small>
      </div>

      <div>
        <DataTable :value="acl_data!.entries" dataKey="id">
          <Column field="name" header="Name" sortable></Column>
        </DataTable>
      </div>
      <template #footer>
        <Button label="Cancel" icon="pi pi-times" text @click="closeModal(false)" />
        <Button label="Save" icon="pi pi-check" @click="saveACL" />
      </template>
    </Dialog>
  <!-- </Form> -->
</template>
