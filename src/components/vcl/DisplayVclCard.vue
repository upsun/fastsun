<script setup lang="ts">
import { ref } from 'vue';
import Dialog from 'primevue/dialog';

// Init
const copied = ref("Copy");
const props = defineProps({
  vcl_data: Object,
  vcl_state_dialog: Boolean,
});

function copy(content: string) {
  copied.value = "Copied";
  window.navigator.clipboard.writeText(content);
}
</script>

<template>
  <Dialog v-bind:visible="vcl_state_dialog"  :modal="true" dismissableMask header="VCL Generated" :style="{  }" :breakpoints="{ '1199px': '75vw', '575px': '90vw' }">
      <div class="flex flex-wrap gap-2 items-center justify-between">
        <label for="" class="">Version {{vcl_data!.number}}</label>
        <Button :label="copied" icon="pi pi-copy" severity="secondary"  test @click="copy(vcl_data!.contentRaw)" class="mr-2" style="margin-left: auto;"></Button>
      </div>
    <div v-html="vcl_data!.contentHtml" class="flex items-center gap-4 mb-4"></div>
  </Dialog>
</template>
