<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SelectButton from 'primevue/selectbutton';
import DatePicker from 'primevue/datepicker';
import Card from 'primevue/card';

import StatCard from '@/components/project/StatCard.vue';
import { TAB_VALUES } from '@/constants/tabs';

// Router setup
const route = useRoute();
const router = useRouter();

// Utility functions for timestamp formatting
const formatDateForUrl = (date: Date): string => {
  return date.getTime().toString(); // Convert to timestamp
};

const parseDateFromUrl = (timestampStr: string): Date | null => {
  if (!timestampStr) return null;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return null;
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? null : date;
};

// Get current week's start (Monday) and end (Sunday)
const getCurrentWeek = (): [Date, Date] => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday

  const startOfWeek = new Date(now.setDate(diff));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  return [startOfWeek, endOfWeek];
};

// Get current month's start and end
const getCurrentMonth = (): [Date, Date] => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return [startOfMonth, endOfMonth];
};

// Get current year's start and end
const getCurrentYear = (): [Date, Date] => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const endOfYear = new Date(now.getFullYear(), 11, 31);

  return [startOfYear, endOfYear];
};

// Get current period based on selected option
const getCurrentPeriod = (period: string): [Date, Date] => {
  switch (period) {
    case 'week':
      return getCurrentWeek();
    case 'month':
      return getCurrentMonth();
    case 'year':
      return getCurrentYear();
    default:
      return getCurrentMonth();
  }
};

// Initialize dates from URL parameters or default to current month
const initializeDatesFromUrl = (): [Date, Date] => {
  // Only load dates from URL if we're on the History tab
  const currentTab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab;
  if (currentTab !== TAB_VALUES.HISTORY) {
    return getCurrentMonth();
  }

  const fromParam = Array.isArray(route.query.from) ? route.query.from[0] : route.query.from;
  const toParam = Array.isArray(route.query.to) ? route.query.to[0] : route.query.to;

  if (fromParam && toParam) {
    const fromDate = parseDateFromUrl(fromParam as string);
    const toDate = parseDateFromUrl(toParam as string);

    if (fromDate && toDate && fromDate <= toDate) {
      return [fromDate, toDate];
    }
  }

  return getCurrentMonth();
};

const dates = ref(initializeDatesFromUrl());
const options = ref([
  { label: 'Weekly', value: 'week' },
  { label: 'Monthly', value: 'month' },
  { label: 'Yearly', value: 'year' },
]);
const selected = ref('month');

// Flag to prevent infinite loops during initialization
const isInitializing = ref(true);

// Set flag after component is mounted
onMounted(() => {
  // Allow URL updates after initial setup - longer delay to avoid conflicts
  setTimeout(() => {
    isInitializing.value = false;
  }, 500);
});

// Watch for changes in selected period and update dates accordingly
watch(selected, (newPeriod) => {
  dates.value = getCurrentPeriod(newPeriod);
});

// Watch URL changes to update dates
watch(
  () => [route.query.from, route.query.to, route.query.tab],
  ([newFrom, newTo, newTab]) => {
    // Only process date changes if we're on the History tab
    const currentTab = Array.isArray(newTab) ? newTab[0] : newTab;
    if (currentTab !== TAB_VALUES.HISTORY) return;

    // Handle case where query params can be arrays
    const fromParam = Array.isArray(newFrom) ? newFrom[0] : newFrom;
    const toParam = Array.isArray(newTo) ? newTo[0] : newTo;

    if (fromParam && toParam) {
      const fromDate = parseDateFromUrl(fromParam as string);
      const toDate = parseDateFromUrl(toParam as string);

      if (fromDate && toDate && fromDate <= toDate) {
        // Only update if the dates are actually different
        const currentDates = dates.value;
        const datesAreDifferent =
          !currentDates ||
          currentDates.length !== 2 ||
          !currentDates[0] ||
          !currentDates[1] ||
          currentDates[0].getTime() !== fromDate.getTime() ||
          currentDates[1].getTime() !== toDate.getTime();

        if (datesAreDifferent) {
          dates.value = [fromDate, toDate];
        }
      }
    }
  },
  { immediate: true },
);

// Watch dates changes to update URL
watch(
  dates,
  (newDates, oldDates) => {
    // Skip URL updates during initialization to avoid conflicts with tab handling
    if (isInitializing.value) return;

    // Only update URL if we're on the History tab
    const currentTab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab;
    if (currentTab !== TAB_VALUES.HISTORY) return;

    if (newDates && newDates.length === 2 && newDates[0] && newDates[1]) {
      const fromStr = formatDateForUrl(newDates[0]);
      const toStr = formatDateForUrl(newDates[1]);

      // Convert query params to string for comparison (they can be arrays)
      const currentFrom = Array.isArray(route.query.from) ? route.query.from[0] : route.query.from;
      const currentTo = Array.isArray(route.query.to) ? route.query.to[0] : route.query.to;

      // Only update URL if dates actually changed and are different from current URL
      const datesChanged =
        !oldDates ||
        !oldDates[0] ||
        !oldDates[1] ||
        newDates[0].getTime() !== oldDates[0].getTime() ||
        newDates[1].getTime() !== oldDates[1].getTime();

      if (datesChanged && (currentFrom !== fromStr || currentTo !== toStr)) {
        router.replace({
          query: {
            ...route.query,
            from: fromStr,
            to: toStr,
          },
        });
      }
    }
  },
  { flush: 'post' },
);
</script>

<template>
  <Card>
    <template #title>Historical statistics</template>
    <template #content>
      <div class="flex">
        <SelectButton v-model="selected" :options="options" optionLabel="label" optionValue="value" />
        <DatePicker v-model="dates" selectionMode="range" :manualInput="false" showIcon class="push-right" />
      </div>
      <StatCard />
    </template>
  </Card>
</template>

<style scoped>
.push-right {
  margin-left: auto;
}
</style>
