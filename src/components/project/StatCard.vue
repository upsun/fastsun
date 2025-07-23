<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import Chart from 'primevue/chart';
import type { Chart as ChartJS, ChartEvent } from 'chart.js';
import ProjectAPIService from './project.service';
import 'chartjs-adapter-date-fns';
import LocalStore from '@/stores/localStorage';

/**
 * Real-time statistics card component for displaying Fastly service metrics.
 * Shows various performance metrics including requests, hits, misses, errors, and calculated ratios.
 * Data is automatically updated every second and displayed in a time-series chart.
 */

// Initialize dependencies and constants
const localStore = new LocalStore();
/** Service token retrieved from local storage for API authentication */
const service_token = localStore.getFastlyToken() || '';
/** Maximum number of data points to display in the chart */
const sampleCount = 60;
/** Toast notification service for displaying errors */
const toast = useToast();

/**
 * Component props definition
 * @property {string} service_id - The Fastly service ID to monitor
 */
const props = defineProps({
  service_id: {
    type: String,
    required: true,
  },
});

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
 * Common dataset configuration options for all chart datasets
 * Provides consistent styling across all data series
 */
const commonDatasetOptions = {
  fill: true,
  tension: 0.3,
  borderWidth: 1,
};

const now = Date.now(); // en millisecondes
const timestamps: number[] = Array.from({ length: sampleCount }, (_, i) => {
  return now - (sampleCount - 1 - i) * 1000;
});

/**
 * Chart data configuration containing labels and datasets
 * Defines all the metrics to be displayed in the chart
 */
const chartData = {
  labels: timestamps,
  datasets: [
    {
      label: 'Request',
      borderColor: '#2196F3',
      backgroundColor: '#2196F320',
      yAxisID: 'y_cnt',
      data: Array.from({ length: sampleCount }).fill(NaN),
      ...commonDatasetOptions,
    },
    {
      label: 'Hit',
      borderColor: '#4CAF50',
      backgroundColor: '#4CAF5020',
      yAxisID: 'y_cnt',
      data: Array.from({ length: sampleCount }).fill(NaN),
      ...commonDatasetOptions,
    },
    {
      label: 'Pass',
      borderColor: '#9C27B0',
      backgroundColor: '#9C27B020',
      yAxisID: 'y_cnt',
      data: Array.from({ length: sampleCount }).fill(NaN),
      ...commonDatasetOptions,
    },
    {
      label: 'Miss',
      borderColor: '#FF7043',
      backgroundColor: '#FF704320',
      yAxisID: 'y_cnt',
      data: Array.from({ length: sampleCount }).fill(NaN),
      ...commonDatasetOptions,
    },
    {
      label: 'Error',
      borderColor: '#F44336',
      backgroundColor: '#F4433620',
      yAxisID: 'y_cnt',
      data: Array.from({ length: sampleCount }).fill(NaN),
      ...commonDatasetOptions,
    },
    {
      label: 'Origin offload',
      borderColor: '#FF7043',
      backgroundColor: '#FF704320',
      yAxisID: 'y_per',
      hidden: true,
      data: Array.from({ length: sampleCount }).fill(NaN),
      ...commonDatasetOptions,
    },
    {
      label: 'Hit ratio',
      borderColor: '#9C27B0',
      backgroundColor: '#9C27B020',
      yAxisID: 'y_per',
      hidden: true,
      data: Array.from({ length: sampleCount }).fill(NaN),
      ...commonDatasetOptions,
    },
    {
      label: 'Cache Coverage',
      borderColor: '#00BCD4',
      backgroundColor: '#00BCD420',
      yAxisID: 'y_per',
      hidden: true,
      data: Array.from({ length: sampleCount }).fill(NaN),
      ...commonDatasetOptions,
    },
  ],
};

/**
 * Custom Chart.js plugin for displaying a vertical cursor line
 * Provides interactive feedback when hovering over the chart
 */
const verticalLinePlugin = {
  id: 'cursorLine',
  /**
   * Event handler for tracking cursor position
   */
  afterEvent(chart: ChartJS, args: { event: ChartEvent & { x: number } }) {
    const {
      ctx,
      chartArea: { top, bottom },
      scales: { x },
    } = chart;
    const event = args.event;

    if (event.x >= x.left && event.x <= x.right) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      chart._cursorX = event.x;
    }
  },

  /**
   * Draws the vertical cursor line on the chart
   */
  afterDraw(chart: ChartJS) {
    const {
      ctx,
      chartArea: { top, bottom },
      _cursorX,
    } = chart as ChartJS & { _cursorX?: number };
    if (_cursorX) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(_cursorX, top);
      ctx.lineTo(_cursorX, bottom);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.stroke();
      ctx.restore();
    }
  },
};

/**
 * Chart configuration options for the time-series chart
 * Defines scales, tooltips, legends, and other chart behaviors
 */
const chartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: {
    mode: 'nearest',
    intersect: true,
  },
  plugins: {
    legend: {
      display: true,
      position: 'right',
      labels: {
        boxWidth: 12,
        padding: 10,
        font: {
          size: 13,
        },
        usePointStyle: true,
        pointStyle: 'rect',
      },
    },
    tooltip: {
      callbacks: {
        /**
         * Custom tooltip label formatter
         * @param {object} context - Tooltip context containing dataset and parsed data
         * @param {object} context.dataset - Dataset configuration with label and yAxisID
         * @param {object} context.parsed - Parsed data point with x and y values
         * @returns {string} Formatted tooltip label with appropriate units
         */
        label: function (context: { dataset: { label: string; yAxisID: string }; parsed: { y: number } }) {
          const datasetLabel = context.dataset.label || '';
          const value = context.parsed.y;

          // Add appropriate unit based on the dataset
          if (context.dataset.yAxisID === 'y_per') {
            return `${datasetLabel}: ${value.toFixed(2)}%`;
          } else {
            return `${datasetLabel}: ${value} req`;
          }
        },
      },
      mode: 'index',
      intersect: false,
    },
  },
  scales: {
    y_cnt: {
      type: 'linear',
      display: true,
      position: 'left',
      min: 0,
      suggestedMax: 2,
      ticks: {
        stepSize: 1,
        /**
         * Custom tick label formatter for count axis
         * @param {number} value - The tick value
         * @returns {string} Formatted tick label with 'req' suffix
         */
        callback: function (value: number) {
          return value + ' req';
        },
      },
      title: {
        display: true,
        text: 'Count',
      },
    },
    y_per: {
      type: 'linear',
      display: true,
      position: 'right',
      min: 0,
      max: 100,
      ticks: {
        /**
         * Custom tick label formatter for percentage axis
         * @param {number} value - The tick value
         * @returns {string} Formatted tick label with '%' suffix
         */
        callback: function (value: number) {
          return value + '%';
        },
      },
      title: {
        display: true,
        text: 'Percentage',
      },
      grid: {
        drawOnChartArea: false,
      },
    },
    x: {
      type: 'time',
      time: {
        unit: 'second',
        unitStepSize: 1,
        displayFormats: {
          second: 'hh:mm:ss',
        },
      },
      title: {
        display: true,
        text: 'Time',
      },
    },
  },
});

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
  const projectService = new ProjectAPIService(props.service_id!, service_token);

  projectService
    .getStat()
    .then((result) => {
      if (result.Data.length > 0) {
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

        // Update chart with new data
        chart.update();
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
