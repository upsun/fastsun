<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Toast from 'primevue/toast';
import AppFooter from './AppFooter.vue';
import AppSidebar from './AppSidebar.vue';
import AppTopbar from './AppTopbar.vue';
</script>

<template>
  <div class="layout-wrapper">
      <!-- <AppTopbar /> -->
      <AppSidebar />
      <div class="layout-main-container">
          <div class="layout-main">
              <router-view></router-view>
          </div>
          <AppFooter />
      </div>
      <div class="layout-mask animate-fadein"></div>
  </div>
  <Toast />
</template>
