<script setup lang="ts">
import { type PropType } from 'vue';
import PurgesCard from '@/components/purges/PurgeCard.vue';
import type ProjectEntity from '@/components/project/project.interface';
import ApiCache from '@/stores/localStorage';

// Init
const props = defineProps({
  service_id: {
    type: String,
    required: true,
  },
  project_detail: {
    type: Object as PropType<ProjectEntity>,
    required: true,
  },
  vcl_version: {
    type: Number,
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
  service_token: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['update:visible']);
const apiStorage = new ApiCache();

function logout() {
  console.log('FastSun > Logout for project:', props.project_id, 'environment:', props.environment_id);
  apiStorage.resetFastly(props.project_id, props.environment_id);

  emit('update:visible', 'reload');
}
</script>

<template>
  <Card>
    <template #title>
      <div class="card-title-header">
        <span>CDN summary</span>
        <Button icon="pi pi-sign-out" outlined rounded @click="logout" label="Logout Fastly" />
      </div>
    </template>
    <template #content>
      <div class="info-card-content">
        <div class="info-row">
          <div class="info-item">
            <span class="info-label">Fastly Service ID</span>
            <div class="info-value">
              <a class="info-link" href="" target="_blank" style="pointer-events: none">
                <!-- :href="'https://manage.fastly.com/configure/services/' + service_id" -->
                {{ service_id }}
              </a>
            </div>
          </div>

          <div class="info-item">
            <span class="info-label">Current Version</span>
            <div class="info-value">
              <span class="version-badge">v{{ vcl_version }}</span>
            </div>
          </div>
        </div>

        <PurgesCard />

        <div class="external-links">
          <a href="https://fiddle.fastly.dev/" target="_blank" class="external-link"> Fastly Fiddle (for testing) </a>
        </div>
      </div>
    </template>
  </Card>
</template>
