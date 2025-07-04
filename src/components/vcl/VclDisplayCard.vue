<script setup lang="ts">
import { ref, type PropType } from 'vue';
import Dialog from 'primevue/dialog';
import type VclEntity from './vcl.interface';

// Init
const copied = ref<string>('Copy');
const props = defineProps({
  vcl_data: {
    type: Object as PropType<VclEntity>,
    required: true,
  },
  vcl_state_dialog: {
    type: Boolean,
    required: true,
  },
});

function copy(content: string) {
  copied.value = 'Copied';
  window.navigator.clipboard.writeText(content);
}
</script>

<template>
  <Dialog
    v-bind:visible="vcl_state_dialog"
    :modal="true"
    dismissableMask
    maximizable
    header="VCL Generated"
    :style="{ width: '80rem' }"
    :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
  >
    <div class="flex flex-wrap gap-2 items-center justify-between">
      <label for="" class="">Version {{ vcl_data!.number }}</label>
      <Button
        :label="copied"
        icon="pi pi-copy"
        severity="secondary"
        test
        @click="copy(vcl_data!.contentRaw)"
        class="mr-2"
        style="margin-left: auto"
      ></Button>
    </div>
    <div v-html="vcl_data!.contentHtml" class="flex items-center gap-4 mb-4"></div>
  </Dialog>
</template>
