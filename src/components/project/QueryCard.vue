<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SelectButton from 'primevue/selectbutton';
import DatePicker from 'primevue/datepicker';
import Card from 'primevue/card';
import Chart from 'primevue/chart';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import 'chartjs-adapter-date-fns';

import { useCredentialsStore } from '@/stores/credentialsStore';
import ProjectAPIService from './project.service';
import { TAB_VALUES, type TabValue } from '@/utils/tabsTools';
import { formatDateForUrl, parseDateFromUrl, getCurrentMonth, getCurrentPeriod, DATE_PERIODS } from '@/utils/dateTools';
import { verticalLinePlugin, createHistoricalChartOptions, createChartData } from '@/utils/chartTools';
import { validateTabValue, validateDateRange } from '@/utils/securityUtils';
import { usePluginSDK } from 'pluginapp-sdk-node';

// Router setup
const route = useRoute();
const router = useRouter();

// Initialize dependencies and constants
const credentialsStore = useCredentialsStore();

const { sdk } = usePluginSDK();

// Metrics to display
enum MetricKey {
  BANDWIDTH,
  REQUESTS,
  HITS,
  PASS,
  MISS,
  ERRORS,
  ORIGIN_OFFLOAD,
  HIT_RATIO,
  CACHE_COVERAGE,

  ALL_STATUS_2XX,
  ALL_STATUS_3XX,
  ALL_STATUS_4XX,
  ALL_STATUS_5XX,
  STATUS_406,
  STATUS_404,
  STATUS_429,
  MISS_TIME,
}

interface MetricSpec {
  /**
   * Unique identifier for the metric
   */
  id: string;
  /**
   * Display label for the metric
   */
  label: string;
  /**
   * Indicates if the metric is a percentage
   */
  isPercent: boolean;
  /**
   * Conversion factor to apply to the raw metric value
   */
  tooltip?: string;
  /**
   * Conversion factor to apply to the raw metric value (e.g., 100 to convert to percentage)
   */
  convert?: number;
  /**
   * Number of decimal places to display
   */
  decimal?: number;
}

const metricsList: Map<MetricKey, MetricSpec> = new Map([
  // Base count metrics
  [MetricKey.BANDWIDTH, { id: 'bandwidth', label: 'Bandwidth (B)', isPercent: false }],
  [MetricKey.REQUESTS, { id: 'requests', label: 'Requests', isPercent: false }],
  [MetricKey.HITS, { id: 'hits', label: 'Hits', isPercent: false }],
  [MetricKey.PASS, { id: 'pass', label: 'Pass', isPercent: false }],
  [MetricKey.MISS, { id: 'miss', label: 'Miss', isPercent: false }],
  [MetricKey.ERRORS, { id: 'errors', label: 'Errors', isPercent: false, tooltip: 'HTTP 5xx+4xx responses' }],

  // Base percentage metrics
  [
    MetricKey.ORIGIN_OFFLOAD,
    { id: 'origin_offload', label: 'Origin Offload (%)', isPercent: true, convert: 100, decimal: 2 },
  ],
  [MetricKey.HIT_RATIO, { id: 'hit_ratio', label: 'Hit Ratio (%)', isPercent: true, decimal: 2 }],
  [MetricKey.CACHE_COVERAGE, { id: 'cache_coverage', label: 'Cache Coverage (%)', isPercent: true, decimal: 2 }],

  // Extra metrics
  [MetricKey.ALL_STATUS_2XX, { id: 'all_status_2xx', label: 'All Status 2xx', isPercent: false }],
  [MetricKey.ALL_STATUS_3XX, { id: 'all_status_3xx', label: 'All Status 3xx', isPercent: false }],
  [MetricKey.ALL_STATUS_4XX, { id: 'all_status_4xx', label: 'All Status 4xx', isPercent: false }],
  [MetricKey.ALL_STATUS_5XX, { id: 'all_status_5xx', label: 'All Status 5xx', isPercent: false }],
  [MetricKey.STATUS_406, { id: 'status_406', label: 'Status 406', isPercent: false }],
  [MetricKey.STATUS_404, { id: 'status_404', label: 'Status 404', isPercent: false }],
  [MetricKey.STATUS_429, { id: 'status_429', label: 'Status 429', isPercent: false }],
  [MetricKey.MISS_TIME, { id: 'miss_time', label: 'Miss Time (ms)', isPercent: false, convert: 0.01, decimal: 2 }],
]);

// Variable pour stocker les stats cumulées
interface MetricDisplay extends MetricSpec {
  cumulated: number;
  avg: number;
  min: number;
  max: number;
  percentile95: number;
}

const cumulatedStat = ref<MetricDisplay[]>([]);

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

// Flag to track when loading from external component
const isLoadingFromExternal = ref(false);

const chartData = createChartData(6);

/** Reference to the Chart component instance */
const chartInstance = ref();

// Function to load historical data - extracted from onMounted to be reusable
const loadHistoricalData = async (forceDates?: [Date, Date]) => {
  const activeDates = forceDates || dates.value;

  if (!activeDates || activeDates.length !== 2 || !activeDates[0] || !activeDates[1]) {
    return; // No valid date range selected
  }

  isLoading.value = true;

  try {
    const projectService = new ProjectAPIService(credentialsStore.getServiceId(), credentialsStore.getServiceToken());

    // Convert selected dates to timestamps (in seconds)
    const fromTimestamp = Math.floor(activeDates[0].getTime() / 1000).toString();

    // For the end date, we need to include the entire day, so we add 24 hours - 1 second
    // This ensures that the API includes data for the last selected day
    const endOfDay = new Date(activeDates[1]);
    endOfDay.setHours(23, 59, 59, 999); // Set to end of the day
    const toTimestamp = Math.floor(endOfDay.getTime() / 1000).toString();

    console.log('Loading historical data for dates:', {
      from: activeDates[0].toISOString(),
      to: activeDates[1].toISOString(),
      toEndOfDay: endOfDay.toISOString(),
      fromTimestamp,
      toTimestamp,
    });

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chart.data.datasets.forEach((dataset: any) => {
      dataset.data = [];
    });

    if (result.data.length > 0) {
      // La première valeur de l'array correspond au timestamp 'from' (en secondes)
      // On convertit en millisecondes pour Chart.js
      const fromTimestampMs = parseInt(fromTimestamp) * 1000;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    computeCumulatedStat(result);

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

function computeCumulatedStat(result: { data: Array<Record<string, number>> }) {
  // Reset stats
  cumulatedStat.value = [];

  const metricsArr: Record<MetricKey, number[]> = {} as Record<MetricKey, number[]>;

  // Normalize data into arrays for each metric
  metricsList.forEach((metricSpec: MetricSpec, metricKey: MetricKey) => {
    metricsArr[metricKey] = []; // Initialize array
    switch (metricKey) {
      case MetricKey.HIT_RATIO:
        metricsArr[metricKey] = result.data.map((d) => {
          const hits = d.hits ?? 0;
          const miss = d.miss ?? 0;
          return hits + miss > 0 ? (hits / (hits + miss)) * 100 : 0;
        });
        break;
      case MetricKey.CACHE_COVERAGE:
        metricsArr[metricKey] = result.data.map((d) => {
          const hits = d.hits ?? 0;
          const miss = d.miss ?? 0;
          const pass = d.pass ?? 0;
          return hits + miss + pass > 0 ? ((hits + miss) / (hits + miss + pass)) * 100 : 0;
        });
        break;

      // All other metrics are direct mappings
      default:
        metricsArr[metricKey] = result.data.map((d) => d[metricSpec.id] ?? 0);
        break;
    }
  });

  // Make calculations (min, max...) for each metric
  metricsList.forEach((metricSpec: MetricSpec, metricKey: MetricKey) => {
    const metrics: number[] = metricsArr[metricKey];
    const sorted = [...metrics].sort((a, b) => a - b);
    const stat: MetricDisplay = {
      ...metricSpec,

      cumulated: metrics.reduce((a, b) => a + b, 0),
      avg: metrics.length ? metrics.reduce((a, b) => a + b, 0) / metrics.length : 0,
      min: metrics.length ? Math.min(...metrics) : 0,
      max: metrics.length ? Math.max(...metrics) : 0,
      percentile95: metrics.length ? Number(sorted[Math.max(0, Math.floor(0.95 * sorted.length) - 1)] ?? 0) : 0,
    };

    cumulatedStat.value.push(stat);
  });
}

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
  // Check if we need to load dates from external component first
  const currentTab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab;
  const fromParam = Array.isArray(route.query.from) ? route.query.from[0] : route.query.from;
  const toParam = Array.isArray(route.query.to) ? route.query.to[0] : route.query.to;

  // Only load immediately if we're on History tab AND we have dates in URL OR we're not on History tab
  if (currentTab === TAB_VALUES.HISTORY) {
    if (fromParam && toParam) {
      // We have URL dates, load immediately
      await loadHistoricalData();
    } else {
      // We don't have URL dates, check external component first
      try {
        const urlProps = await sdk.getUrlParams<UrlProps>();
        if (urlProps && urlProps.from && urlProps.to) {
          // External component has dates, they will be handled by the URL watcher
          console.log('Dates will be loaded from external component');
          return;
        } else {
          // No external dates, load with current dates
          await loadHistoricalData();
        }
      } catch (error) {
        // Error getting external dates, load with current dates
        console.log('Error getting external dates, loading with current dates');
        await loadHistoricalData();
      }
    }
  } else {
    // Not on History tab, load immediately
    await loadHistoricalData();
  }
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

interface UrlProps {
  from?: string;
  to?: string;
  tab?: TabValue;
}

/**
 * Formats a numeric value without decimals and with thousands separator
 */
function format_int(value: number | string, convert: number = 1, decimal: number = 0): string {
  if (value === null || value === undefined || isNaN(Number(value))) return '';

  const valueConverted = Number(value) * convert;
  return valueConverted.toLocaleString('fr-FR', { maximumFractionDigits: decimal });
}

// Watch URL changes to update dates and mode
watch(
  () => [route.query.from, route.query.to, route.query.tab],
  async ([newFrom, newTo, newTab]) => {
    // Only process date changes if we're on the History tab
    const currentTab = Array.isArray(newTab) ? newTab[0] : newTab;
    if (currentTab !== TAB_VALUES.HISTORY) return;

    let fromParam = newFrom;
    let toParam = newTo;

    if (!newFrom && !newTo) {
      const urlProps = await sdk.getUrlParams<UrlProps>();
      if (urlProps) {
        fromParam = urlProps.from;
        toParam = urlProps.to;
      }
    }

    // Handle case where query params can be arrays
    fromParam = Array.isArray(fromParam) ? fromParam[0] : fromParam;
    toParam = Array.isArray(toParam) ? toParam[0] : toParam;

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
          // Update mode based on the date range first
          selected.value = initializeModeFromDates([fromDate, toDate]);

          // Force reload of historical data when dates come from external component
          if (!newFrom && !newTo) {
            isLoadingFromExternal.value = true;
            // Load data with the new dates directly, before updating dates.value
            await loadHistoricalData([fromDate, toDate]);
            isLoadingFromExternal.value = false;
          }

          // Update dates.value after loading data
          dates.value = [fromDate, toDate];
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
        const query = {
          ...route.query,
          from: fromStr,
          to: toStr,
        };

        // Console mode.
        await sdk.setUrlParams(query);

        // Standalone mode.
        router.replace({ query });

        // Reload historical data when dates change (but not if already loading from external)
        if (!isLoadingFromExternal.value) {
          await loadHistoricalData();
        }
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
      <div class="mt-5">
        <DataTable
          :value="cumulatedStat"
          stripedRows
          resizableColumns
          columnResizeMode="fit"
          sortField=""
          :sortOrder="-1"
          :defaultSortOrder="-1"
          class="p-datatable-sm real-stats-table"
          :responsiveLayout="'scroll'"
        >
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-xl font-bold">Cumulated statistics</span>
            </div>
          </template>
          <Column field="label" header="Metrics" sortable>
            <template #body="slotProps">
              <span v-tooltip.left="slotProps.data.tooltip">
                {{ slotProps.data.label }}
              </span>
            </template>
          </Column>
          <Column field="cumulated" header="Total" sortable style="text-align: right">
            <template #body="slotProps">
              <span v-if="!slotProps.data.isPercent">
                {{ format_int(slotProps.data.cumulated, slotProps.data.convert, slotProps.data.decimal) }}
              </span>
            </template>
          </Column>
          <Column field="avg" header="Average" sortable style="text-align: right">
            <template #body="slotProps">
              <span>{{ format_int(slotProps.data.avg, slotProps.data.convert, slotProps.data.decimal) }}</span>
            </template>
          </Column>
          <Column field="min" header="Min" sortable style="text-align: right">
            <template #body="slotProps">
              <span>{{ format_int(slotProps.data.min, slotProps.data.convert, slotProps.data.decimal) }}</span>
            </template>
          </Column>
          <Column field="max" header="Max" sortable style="text-align: right">
            <template #body="slotProps">
              <span>{{ format_int(slotProps.data.max, slotProps.data.convert, slotProps.data.decimal) }}</span>
            </template>
          </Column>
          <Column field="percentile95" header="95th Percentile" sortable style="text-align: right">
            <template #body="slotProps">
              <span>{{ format_int(slotProps.data.percentile95, slotProps.data.convert, slotProps.data.decimal) }}</span>
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
  </Card>
</template>
