<script setup lang="ts">
import { ref } from 'vue';
import InputText from 'primevue/inputtext';
import ApiCache from '@/stores/localStorage';

const apiStorage = new ApiCache();
const props = defineProps({
  service_id: {
    type: String,
    required: true,
  },
});
const emit = defineEmits(['update:visible']);
const fastly_id = ref(props.service_id);
const fastly_token = ref(apiStorage.getFastlyToken() || '');
const submitted = ref<boolean>(false);


function closeModal(updated = false) {
  emit('update:visible', updated);
}

function saveId() {
  submitted.value = true;

  if (fastly_id.value && fastly_token.value) {
    console.log('Set ID & Token!');
    apiStorage.setFastlyId(fastly_id.value);
    apiStorage.setFastlyToken(fastly_token.value);

    closeModal();
  }
}
</script>
<template>
  <Card>
    <template #title v-if="false">Domain Information</template>
    <template #content>
      <div>
        <label for="fastly_id" class="block font-bold mb-3">Fastly Service ID</label>
        <InputText
          id="fastly_id"
          v-model.trim="fastly_id"
          required="true"
          autofocus
          :invalid="submitted && !fastly_id"
          fluid
        />
        <small v-if="submitted && !fastly_id" class="text-red-500">Fastly service ID is required.</small>
      </div><br/>

      <div>
        <label for="fastly_token" class="block font-bold mb-3">Fastly Service Token</label>
        <InputText
          id="fastly_token"
          type="password"
          v-model.trim="fastly_token"
          required="true"
          autofocus
          :invalid="submitted && !fastly_token"
          fluid
        />
        <small v-if="submitted && !fastly_token" class="text-red-500">Fastly service Token is required.</small>
      </div><br />
    </template>
    <template #footer>
      <Button label="Save" icon="pi pi-check" @click="saveId" />
    </template>
  </Card>
</template>
