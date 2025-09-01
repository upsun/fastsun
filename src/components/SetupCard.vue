<script setup lang="ts">
import { ref } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import ApiCache from '@/stores/localStorage';

const apiStorage = new ApiCache();
const props = defineProps({
  service_id: {
    type: String,
    required: true,
  },
  project_id: {
    type: String,
    required: false,
    default: 'default',
  },
  environment_id: {
    type: String,
    required: false,
    default: 'default',
  },
});
const emit = defineEmits(['update:visible', 'credentials:saved']);
const fastly_id = ref(props.service_id);
const fastly_token = ref('');
const submitted = ref<boolean>(false);

// Load existing token for this project and environment
const existingCredentials = apiStorage.getFastlyCredentials(props.project_id, props.environment_id);
if (existingCredentials) {
  fastly_token.value = existingCredentials.fastlyToken;
}

function closeModal(updated = false) {
  emit('update:visible', updated);
}

function saveId() {
  submitted.value = true;

  if (fastly_id.value && fastly_token.value) {
    console.log('FastSun > Set ID & Token for project:', props.project_id, 'environment:', props.environment_id);
    apiStorage.setFastlyCredentials(props.project_id, props.environment_id, fastly_id.value, fastly_token.value);

    // Emit the saved credentials to parent component
    emit('credentials:saved', {
      projectId: props.project_id,
      environmentId: props.environment_id,
      fastlyId: fastly_id.value,
      fastlyToken: fastly_token.value,
    });

    closeModal(true);
  }
}
</script>
<template>
  <Card>
    <template #title>Setup Fastly Credentials</template>
    <template #content>
      <div class="setupcard-explanation text-sm text-gray-700">
        Your Fastly credentials are stored securely within your browser and are never transmitted to Upsun.<br />
        This method enhances security by ensuring that your credentials are not shared with any third parties, thereby
        reducing the risk of unauthorized access.<br />
        Please note that if you access Upsun from a different browser or device, you will be required to re-enter your
        Fastly credentials.<br />
      </div>

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
      </div>
      <br />

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
      </div>
      <br />
    </template>
    <template #footer>
      <Button label="Save" icon="pi pi-check" @click="saveId" />
    </template>
  </Card>
</template>
