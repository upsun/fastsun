<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SelectButton from 'primevue/selectbutton';
import DatePicker from 'primevue/datepicker';
import Card from 'primevue/card';
import Chart from 'primevue/chart';
import Button from 'primevue/button';
import 'chartjs-adapter-date-fns';

import { useCredentialsStore } from '@/stores/credentialsStore';
import ProjectAPIService from './project.service';
import { TAB_VALUES } from '@/utils/tabsTools';
import { formatDateForUrl, parseDateFromUrl, getCurrentMonth, getCurrentPeriod, DATE_PERIODS } from '@/utils/dateTools';
import { verticalLinePlugin, createHistoricalChartOptions, createChartData } from '@/utils/chartTools';
import { validateTabValue, validateDateRange } from '@/utils/securityUtils';

// Router setup
const route = useRoute();
const router = useRouter();

// Initialize dependencies and constants
const credentialsStore = useCredentialsStore();

// Initialize dates from URL parameters or default to current month
const initializeDatesFromUrl = (): [Date, Date] => {
  // Only load dates from URL if we're on the History tab
  const currentTab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab;
  const validatedTab = validateTabValue(currentTab);

  if (validatedTab !== TAB_VALUES.HISTORY) {
    return getCurrentMonth();
  }

  const fromParam = Array.isArray(route.query.from) ? route.query.from[0] : route.query.from;
  const toParam = Array.isArray(route.query.to) ? route.query.to[0] : route.query.to;

  if (fromParam && toParam && typeof fromParam === 'string' && typeof toParam === 'string') {
    const fromDate = parseDateFromUrl(fromParam);
    const toDate = parseDateFromUrl(toParam);

    if (fromDate && toDate && validateDateRange(fromDate, toDate)) {
      return [fromDate, toDate];
    }
  }

  return getCurrentMonth();
};

// Initialize mode based on URL dates or default to MONTH
const initializeModeFromDates = (dateRange: [Date, Date]): string => {
  const [fromDate, toDate] = dateRange;
  const diffInDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));

  // Determine mode based on date range duration
  if (diffInDays <= 7) {
    return DATE_PERIODS.WEEK;
  } else if (diffInDays <= 31) {
    return DATE_PERIODS.MONTH;
  } else {
    return DATE_PERIODS.YEAR;
  }
};

const dates = ref(initializeDatesFromUrl());
const selected = ref(initializeModeFromDates(dates.value));
const options = ref([
  { label: 'Weekly', value: DATE_PERIODS.WEEK },
  { label: 'Monthly', value: DATE_PERIODS.MONTH },
  { label: 'Yearly', value: DATE_PERIODS.YEAR },
]);

const chartOptions = ref(createHistoricalChartOptions('day', 1));

// Loading state for API calls
const isLoading = ref(false);

const chartData = createChartData(6);

/** Reference to the Chart component instance */
const chartInstance = ref();

// Function to load historical data - extracted from onMounted to be reusable
const loadHistoricalData = async () => {
  if (!dates.value || dates.value.length !== 2 || !dates.value[0] || !dates.value[1]) {
    return; // No valid date range selected
  }

  isLoading.value = true;

  try {
    const projectService = new ProjectAPIService(credentialsStore.getServiceId(), credentialsStore.getServiceToken());

    // Convert selected dates to timestamps (in seconds)
    const fromTimestamp = Math.floor(dates.value[0].getTime() / 1000).toString();
    const toTimestamp = Math.floor(dates.value[1].getTime() / 1000).toString();

    const result = await projectService.getHistoricalData(fromTimestamp, toTimestamp, 'day');

    // Check if chart instance is still available (avoid error during logout)
    if (!chartInstance.value || !chartInstance.value.chart) {
      return;
    }
    const chart = chartInstance.value.chart;
    // Force chart to resize to container
    chart.resize();

    // Clear existing data
    chart.data.labels = [];
    chart.data.datasets.forEach((dataset: any) => {
      dataset.data = [];
    });

    if (result.data.length > 0) {
      // La première valeur de l'array correspond au timestamp 'from' (en secondes)
      // On convertit en millisecondes pour Chart.js
      const fromTimestampMs = parseInt(fromTimestamp) * 1000;

      result.data.forEach((data: any, index: number) => {
        // Extract raw metrics from API response
        const cnt_request = data.requests || 0;
        const cnt_hit = data.hits || 0;
        const cnt_error = data.errors || 0;
        const cnt_miss = data.miss || 0;
        const cnt_pass = data.pass || 0;

        // Calculate origin offload percentage
        let cnt_origin_offload = data.origin_offload * 100;
        if (!cnt_origin_offload) {
          cnt_origin_offload = 0;
        }

        // Calculate hit ratio percentage
        let cnt_hit_ratio = 0;
        if (cnt_hit + cnt_miss > 0) {
          cnt_hit_ratio = (cnt_hit / (cnt_hit + cnt_miss)) * 100;
        }

        // Calculate cache coverage percentage
        let cnt_cache_coverage = 0;
        if (cnt_hit + cnt_miss + cnt_pass > 0) {
          cnt_cache_coverage = ((cnt_hit + cnt_miss) / (cnt_hit + cnt_miss + cnt_pass)) * 100;
        }

        // Calculate the timestamp for this data point
        // Each index represents one day after the 'from' date
        // Set timestamp to 00:00:00 of each day
        const fromDate = new Date(fromTimestampMs);
        const targetDate = new Date(fromDate);
        targetDate.setDate(fromDate.getDate() + index);
        targetDate.setHours(0, 0, 0, 0); // Set to 00:00:00.000
        const dataTimestamp = targetDate.getTime();
        chart.data.labels.push(dataTimestamp);
        chart.data.datasets[0].data.push(cnt_request);
        chart.data.datasets[1].data.push(cnt_hit);
        chart.data.datasets[2].data.push(cnt_pass);
        chart.data.datasets[3].data.push(cnt_miss);
        chart.data.datasets[4].data.push(cnt_error);
        chart.data.datasets[5].data.push(cnt_origin_offload);
        chart.data.datasets[6].data.push(cnt_hit_ratio);
        chart.data.datasets[7].data.push(cnt_cache_coverage);
      });
    }

    // Update chart with new data (check if chart still exists)
    // This will display an empty chart if no data is available
    if (chart && chart.update) {
      chart.update();
    }
  } catch (error) {
    console.error('Error loading historical data:', error);
  } finally {
    isLoading.value = false;
  }
};

// Navigation functions for date range
const navigatePrevious = () => {
  if (!dates.value || dates.value.length !== 2 || !dates.value[0] || !dates.value[1]) {
    return;
  }

  const currentFrom = new Date(dates.value[0]);
  const currentTo = new Date(dates.value[1]);
  let newFrom: Date;
  let newTo: Date;

  switch (selected.value) {
    case DATE_PERIODS.WEEK:
      // Move back 1 week
      newFrom = new Date(currentFrom);
      newFrom.setDate(currentFrom.getDate() - 7);
      newTo = new Date(currentTo);
      newTo.setDate(currentTo.getDate() - 7);
      break;
    case DATE_PERIODS.MONTH:
      // Move back 1 month
      newFrom = new Date(currentFrom);
      newFrom.setMonth(currentFrom.getMonth() - 1);
      newTo = new Date(currentTo);
      newTo.setMonth(currentTo.getMonth() - 1);
      break;
    case DATE_PERIODS.YEAR:
      // Move back 1 year
      newFrom = new Date(currentFrom);
      newFrom.setFullYear(currentFrom.getFullYear() - 1);
      newTo = new Date(currentTo);
      newTo.setFullYear(currentTo.getFullYear() - 1);
      break;
    default:
      return;
  }

  dates.value = [newFrom, newTo];
};

const navigateNext = () => {
  if (!dates.value || dates.value.length !== 2 || !dates.value[0] || !dates.value[1]) {
    return;
  }

  const currentFrom = new Date(dates.value[0]);
  const currentTo = new Date(dates.value[1]);
  let newFrom: Date;
  let newTo: Date;

  switch (selected.value) {
    case DATE_PERIODS.WEEK:
      // Move forward 1 week
      newFrom = new Date(currentFrom);
      newFrom.setDate(currentFrom.getDate() + 7);
      newTo = new Date(currentTo);
      newTo.setDate(currentTo.getDate() + 7);
      break;
    case DATE_PERIODS.MONTH:
      // Move forward 1 month
      newFrom = new Date(currentFrom);
      newFrom.setMonth(currentFrom.getMonth() + 1);
      newTo = new Date(currentTo);
      newTo.setMonth(currentTo.getMonth() + 1);
      break;
    case DATE_PERIODS.YEAR:
      // Move forward 1 year
      newFrom = new Date(currentFrom);
      newFrom.setFullYear(currentFrom.getFullYear() + 1);
      newTo = new Date(currentTo);
      newTo.setFullYear(currentTo.getFullYear() + 1);
      break;
    default:
      return;
  }

  dates.value = [newFrom, newTo];
};

// Function to go back to current period based on selected mode
const goToToday = () => {
  const today = new Date();
  let newDates: [Date, Date];

  switch (selected.value) {
    case DATE_PERIODS.WEEK:
      // Get current week (Monday to Sunday)
      const currentDay = today.getDay();
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // Handle Sunday (0) case

      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + mondayOffset);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      newDates = [weekStart, weekEnd];
      break;
    case DATE_PERIODS.MONTH:
      // Get current month
      newDates = [
        new Date(today.getFullYear(), today.getMonth(), 1),
        new Date(today.getFullYear(), today.getMonth() + 1, 0),
      ];
      break;
    case DATE_PERIODS.YEAR:
      // Get current year
      newDates = [new Date(today.getFullYear(), 0, 1), new Date(today.getFullYear(), 11, 31)];
      break;
    default:
      return;
  }

  dates.value = newDates;
};

// Function to get the first week of a given month
const getFirstWeekOfMonth = (referenceDate: Date): [Date, Date] => {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  // Get first day of the month
  const firstDay = new Date(year, month, 1);

  // Find the Monday of the week containing the first day
  const dayOfWeek = firstDay.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Handle Sunday (0) case

  const weekStart = new Date(firstDay);
  weekStart.setDate(firstDay.getDate() + mondayOffset);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return [weekStart, weekEnd];
};

onMounted(async () => {
  await loadHistoricalData();
});

// Flag to prevent infinite loops during initialization
const isInitializing = ref(true);

// Set flag after component is mounted
onMounted(() => {
  // Allow URL updates after initial setup - longer delay to avoid conflicts
  setTimeout(() => {
    isInitializing.value = false;
  }, 200);
});

// Watch for changes in selected period and update dates accordingly
watch(selected, (newPeriod, oldPeriod) => {
  if (!dates.value || dates.value.length !== 2 || !dates.value[0] || !dates.value[1]) {
    return;
  }

  // Get reference date from current selection (use start date as reference)
  const referenceDate = dates.value[0];

  let newDates: [Date, Date];

  switch (newPeriod) {
    case DATE_PERIODS.WEEK:
      // If switching to weekly, get the first week of the month containing the reference date
      newDates = getFirstWeekOfMonth(referenceDate);
      break;
    case DATE_PERIODS.MONTH:
      // If switching to monthly, get the month containing the reference date
      newDates = [
        new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1),
        new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0),
      ];
      break;
    case DATE_PERIODS.YEAR:
      // If switching to yearly, get the year containing the reference date
      newDates = [new Date(referenceDate.getFullYear(), 0, 1), new Date(referenceDate.getFullYear(), 11, 31)];
      break;
    default:
      return;
  }

  dates.value = newDates;
});

// Watch URL changes to update dates and mode
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
          // Update mode based on the date range from URL
          selected.value = initializeModeFromDates([fromDate, toDate]);
        }
      }
    }
  },
  { immediate: true },
);

// Watch dates changes to update URL and reload data
watch(
  dates,
  async (newDates, oldDates) => {
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

        // Reload historical data when dates change
        await loadHistoricalData();
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
        <div class="flex align-items-center">
          <SelectButton v-model="selected" :options="options" optionLabel="label" optionValue="value" />
          <div v-if="isLoading" class="loading-spinner ml-3">
            <i class="pi pi-spin pi-spinner" style="font-size: 1.2rem; color: var(--p-primary-color)"></i>
          </div>
        </div>
        <div class="navigation-container push-right">
          <Button
            icon="pi pi-chevron-left"
            @click="navigatePrevious"
            size="small"
            outlined
            :title="`Previous ${selected.toLowerCase()}`"
          />
          <Button
            label="Today"
            @click="goToToday"
            size="small"
            outlined
            :title="`Go to current ${selected.toLowerCase()}`"
          />
          <DatePicker v-model="dates" selectionMode="range" :manualInput="false" showIcon />
          <Button
            icon="pi pi-chevron-right"
            @click="navigateNext"
            size="small"
            outlined
            :title="`Next ${selected.toLowerCase()}`"
          />
        </div>
      </div>
      <div class="chart-spacer"></div>
      <Chart
        type="line"
        ref="chartInstance"
        :data="chartData"
        :options="chartOptions"
        :plugins="[verticalLinePlugin]"
        class="w-full h-[25rem] chart-container"
      />
    </template>
  </Card>
</template>
