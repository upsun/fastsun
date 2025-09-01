<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import Chart from 'primevue/chart';
import 'chartjs-adapter-date-fns';

import ProjectAPIService from './project.service';
import { useCredentialsStore } from '@/stores/credentialsStore';
import { verticalLinePlugin, createChartOptions, createChartData } from '../../utils/chartTools';

// Initialize dependencies and constants
const credentialsStore = useCredentialsStore();

/** Toast notification service for displaying errors */
const toast = useToast();

/** Maximum number of data points to display in the chart */
const sampleCount = 60;

/**
 * Reactive references for component state management
 */
/** Timer reference for the automatic data refresh interval */
const timer = ref();
/** Lock flag to prevent concurrent API calls */
const lock = ref<boolean>(false);
/** Reference to the Chart component instance */
const chartInstance = ref();

/**
 * Chart data configuration containing labels and datasets
 * Defines all the metrics to be displayed in the chart
 */
const chartData = createChartData(sampleCount);

/**
 * Chart configuration options using the imported configuration
 */
const chartOptions = ref(createChartOptions());

/**
 * Computed property for the play/pause button icon
 * @returns {string} Icon class name based on timer state
 */
const icon = computed(() => (timer.value ? 'pi pi-pause-circle' : 'pi pi-play-circle'));

/**
 * Component lifecycle hook - starts data collection when component is mounted
 */
onMounted(() => {
  startData();
});

/**
 * Component lifecycle hook - cleans up timer when component is unmounted
 */
onBeforeUnmount(() => {
  pauseData();
});

/**
 * Toggles between paused and running states for data collection
 */
function pauseResume() {
  if (timer.value) {
    pauseData();
  } else {
    startData();
  }
}

/**
 * Stops the automatic data collection by clearing the interval timer
 */
function pauseData() {
  if (timer.value) {
    clearInterval(timer.value);
    timer.value = null;
  }
}

/**
 * Starts the automatic data collection by setting up an interval timer
 * Data is fetched every 1000ms (1 second)
 */
function startData() {
  if (!timer.value) {
    timer.value = setInterval(() => {
      if (!lock.value) {
        getNextStat();
      }
    }, 1000);
  }
}

/**
 * Fetches the next statistics data point from the API and updates the chart
 * Handles data processing, chart updates, and error handling
 */
function getNextStat() {
  lock.value = true;
  const projectService = new ProjectAPIService(credentialsStore.getServiceId(), credentialsStore.getServiceToken());

  projectService
    .getStat()
    .then((result) => {
      if (result.Data.length > 0) {
        // Check if chart instance is still available (avoid error during logout)
        if (!chartInstance.value || !chartInstance.value.chart) {
          return;
        }
        const chart = chartInstance.value.chart;
        // Force chart to resize to container
        chart.resize();

        // Slice old values to maintain maximum sample count
        if (chart.data.labels.length >= sampleCount) {
          chart.data.labels = chart.data.labels.slice(1);
          chart.data.datasets.forEach((dataset: { data: string }, _idx: number) => {
            dataset.data = dataset.data.slice(1);
          });
        }

        // Extract raw metrics from API response
        const cnt_request = result.Data[0].aggregated.requests || 0;
        const cnt_hit = result.Data[0].aggregated.hits || 0;
        const cnt_error = result.Data[0].aggregated.errors || 0;
        const cnt_miss = result.Data[0].aggregated.miss || 0;
        const cnt_pass = result.Data[0].aggregated.pass || 0;

        // Calculate origin offload percentage
        let cnt_origin_offload = result.Data[0].aggregated.origin_offload * 100;
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

        // Add new data points to chart datasets
        chart.data.labels.push(new Date().valueOf());
        chart.data.datasets[0].data.push(cnt_request);
        chart.data.datasets[1].data.push(cnt_hit);
        chart.data.datasets[2].data.push(cnt_pass);
        chart.data.datasets[3].data.push(cnt_miss);
        chart.data.datasets[4].data.push(cnt_error);
        chart.data.datasets[5].data.push(cnt_origin_offload);
        chart.data.datasets[6].data.push(cnt_hit_ratio);
        chart.data.datasets[7].data.push(cnt_cache_coverage);

        // Update chart with new data (check if chart still exists)
        if (chart && chart.update) {
          chart.update();
        }
      }
    })
    .catch((error) => {
      toast.add({ severity: 'error', summary: 'Error', detail: error, life: 5000 });
    })
    .finally(() => {
      lock.value = false;
    });
}
</script>

<template>
  <Card>
    <template #title
      >Real-time statistic
      <Button :icon="icon" class="p-button-text p-button-secondary" @click="pauseResume" />
    </template>
    <template #content>
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
