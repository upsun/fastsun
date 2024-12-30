<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import { useToast } from 'primevue/usetoast';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';

import type DomainEntity from './domain.interface';


// Init
const emit = defineEmits(["update:visible"]);
const toast = useToast();
const props = defineProps({
  domain_data: {
    type: Object,
    required: true,
  },
  domain_state_dialog: {
    type: Boolean,
    required: true,
  },
});

// Data
const submitted = ref<boolean>(false);
const headerTitle = ref<string>("Domain");

function refresh() {
  console.log("Load Domain entity!");

  //TODO check if not null and have a ID only
  if ((props.domain_data === undefined) || (Object.keys(props.domain_data).length === 0)) {
    headerTitle.value = "Add Domain";
  } else {
    headerTitle.value = "Edit Domain";
  }
};
watchEffect(refresh);

// Events
function closeModal(updated = false) {
  emit("update:visible", updated);
};

function saveDomain() {
  //TODO Save by API
  // saveACL(acl

  // if (true) {
    closeModal(true);
    toast.add({ severity: 'success', summary: 'Successful', detail: 'Domain Created', life: 3000 });
  // }
}
</script>

<template>
  <Dialog v-bind:visible="domain_state_dialog" @update:visible="closeModal" :style="{ width: '450px' }" :header="headerTitle" :modal="true" >
      <div>
        <label for="name" class="block font-bold mb-3">Domain</label>
        <InputText id="name" v-model.trim="domain_data!.name" required="true" autofocus :invalid="submitted && !domain_data!.name" fluid />
        <small v-if="submitted && !domain_data!.name" class="text-red-500">Name is required.</small>
      </div>

      <template #footer>
        <Button label="Cancel" icon="pi pi-times" text @click="closeModal(false)" />
        <Button label="Save" icon="pi pi-check" @click="saveDomain" />
      </template>
    </Dialog>
</template>
