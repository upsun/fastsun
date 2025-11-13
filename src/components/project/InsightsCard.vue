<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import Chart from 'primevue/chart';
import Select from 'primevue/select';
import ProgressSpinner from 'primevue/progressspinner';
import 'chartjs-adapter-date-fns';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';

import ProjectAPIService from './project.service';
import { useCredentialsStore } from '@/stores/credentialsStore';
import { verticalLinePlugin } from '../../utils/chartTools';

// Type definitions for Fastly Insights API response structures
interface InsightValue {
  average_bandwidth_bytes?: number;
  bandwidth_percentage?: number;
  cache_hit_ratio?: number;
  miss_rate?: number;
  request_percentage?: number;
  rate?: number;
}

interface InsightDimensions {
  url?: string;
  content_type?: string;
  device?: string;
  os?: string;
  browser?: string;
}

interface InsightDimensionAttributes {
  rate?: number;
}

interface InsightDataItem {
  dimensions?: InsightDimensions;
  values?: InsightValue[];
  dimension_attributes?: InsightDimensionAttributes;
}

interface InsightResponse {
  data: InsightDataItem[];
}

interface ChartConfig {
  key: string;
  title: string;
  type: string;
  data: ChartData;
  options: ChartOptions;
  height?: string;
}

// Initialize dependencies
const credentialsStore = useCredentialsStore();
const toast = useToast();

/** Loading state indicator */
const isLoading = ref<boolean>(false);

/** Lock flag to prevent concurrent API calls */
const lock = ref<boolean>(false);

/** Store the insights data */
const insightsData = ref<Record<string, InsightResponse> | null>(null);

/** Track whether insights are enabled for this service */
const isInsightsEnabled = ref<boolean | null>(null);

/** Chart configurations for each insight metric */
const charts = ref<Map<string, ChartConfig>>(new Map());

/** Time range options */
const timeRangeOptions = [
  { label: 'Last Hour', value: 'hour' },
  { label: 'Last Day', value: 'day' },
  { label: 'Last Week', value: 'week' },
];

/** Selected time range */
const selectedTimeRange = ref('hour');

/** Available visualizations */
const visualizations = [
  'top-url-by-bandwidth',
  'bottom-url-by-cache-hit-ratio',
  'top-url-by-cache-hit-ratio',
  'top-url-by-misses',
  'top-url-by-requests',
  'top-4xx-urls',
  'top-5xx-urls',
  'top-content-type-by-requests',
  'top-device-by-requests',
  'top-os-by-requests',
  'top-browser-by-requests',
  // 'country-statistics', // Not working, skipping
  // 'response-status-codes', // Not working, skipping
  // 'top-503-responses', // Not working, skipping
  // 'top-url-by-duration-sum', // Returns 500 errors, skipping
];

/**
 * Component lifecycle hook - checks insights enablement and fetches initial data when component is mounted
 */
onMounted(async () => {
  await checkInsightsEnabledStatus();
  if (isInsightsEnabled.value) {
    fetchInsights();
  }
});

/**
 * Checks if insights are enabled for this service
 */
async function checkInsightsEnabledStatus() {
  try {
    const projectService = new ProjectAPIService(credentialsStore.getServiceId(), credentialsStore.getServiceToken());
    isInsightsEnabled.value = await projectService.checkInsightsEnabled();
  } catch (error) {
    console.error('Error checking insights enabled status:', error);
    isInsightsEnabled.value = false;
  }
}

/**
 * Calculates start and end times based on selected time range
 */
function getTimeRange() {
  const now = new Date();
  let startTime: Date;

  switch (selectedTimeRange.value) {
    case 'day':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
      break;
    case 'week':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      break;
    case 'hour':
    default:
      startTime = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      break;
  }

  return {
    startTime: startTime.toISOString(),
    endTime: now.toISOString(),
  };
}

/**
 * Fetches insights data from the API
 */
async function fetchInsights() {
  if (lock.value) return;

  lock.value = true;
  isLoading.value = true;

  try {
    const projectService = new ProjectAPIService(credentialsStore.getServiceId(), credentialsStore.getServiceToken());

    const { startTime, endTime } = getTimeRange();

    // Fetch all visualizations
    const allResults: Record<string, InsightResponse> = {};

    for (const visualization of visualizations) {
      try {
        const result = await projectService.getInsights(startTime, endTime, visualization);
        allResults[visualization] = result;
      } catch (error) {
        console.error(`Error fetching ${visualization}:`, error);
      }
    }

    insightsData.value = allResults;

    // Process the data and create chart configurations
    processInsightsData(allResults);

    toast.add({
      severity: 'success',
      summary: 'Insights Updated',
      detail: 'Successfully fetched all insights data',
      life: 3000,
    });
  } catch (error) {
    console.error('Error fetching insights:', error);
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error instanceof Error ? error.message : 'Failed to fetch insights data',
      life: 5000,
    });
  } finally {
    lock.value = false;
    isLoading.value = false;
  }
}

/** Chart handlers mapping - truth table of visualization types to their handler functions */
const chartHandlers: Record<string, (data: InsightDataItem[]) => ChartConfig | null> = {
  'top-url-by-bandwidth': (data) => createBandwidthChart(data, 'Top URLs by Bandwidth'),
  'bottom-url-by-cache-hit-ratio': (data) => createCacheHitRatioChart(data, 'Bottom URLs by Cache Hit Ratio', false),
  'top-url-by-cache-hit-ratio': (data) => createCacheHitRatioChart(data, 'Top URLs by Cache Hit Ratio', true),
  'top-url-by-misses': (data) => createMissRateChart(data, 'Top URLs by Cache Misses'),
  'top-url-by-requests': (data) => createRequestsChart(data, 'Top URLs by Requests'),
  'top-4xx-urls': (data) => createErrorUrlChart(data, 'Top URLs with 4xx Errors'),
  'top-5xx-urls': (data) => createErrorUrlChart(data, 'Top URLs with 5xx Errors'),
  'top-content-type-by-requests': (data) => createContentTypeChart(data, 'Top Content Types by Requests'),
  'top-device-by-requests': (data) => createDeviceChart(data, 'Top Devices by Requests'),
  'top-os-by-requests': (data) => createOsChart(data, 'Top Operating Systems by Requests'),
  'top-browser-by-requests': (data) => createBrowserChart(data, 'Top Browsers by Requests'),
};

/**
 * Processes the insights data and creates chart configurations
 * Handles Fastly Insights API response structure with data array
 */
function processInsightsData(allData: Record<string, InsightResponse>) {
  if (!allData) return;

  charts.value.clear();

  try {
    // Process each visualization
    Object.keys(allData).forEach((visualization) => {
      const data = allData[visualization];

      if (data && data.data && Array.isArray(data.data)) {
        const handler = chartHandlers[visualization];

        if (handler) {
          const chartConfig = handler(data.data);
          if (chartConfig) {
            charts.value.set(visualization, chartConfig);
          }
        } else {
          console.log(`No chart handler for ${visualization} yet`);
        }
      }
    });
  } catch (error) {
    console.error('Error processing insights data:', error);
  }
}

/**
 * Creates a chart for bandwidth data (top URLs by bandwidth)
 */
function createBandwidthChart(dataArray: InsightDataItem[], title: string): ChartConfig | null {
  try {
    if (!dataArray || dataArray.length === 0) return null;

    // Sort by bandwidth (descending - highest first)
    const sortedData = [...dataArray].sort((a, b) => {
      const bandwidthA = a.values?.[0]?.average_bandwidth_bytes || 0;
      const bandwidthB = b.values?.[0]?.average_bandwidth_bytes || 0;
      return bandwidthB - bandwidthA;
    });

    // Extract URLs and bandwidth values
    const labels: string[] = [];
    const bandwidthData: number[] = [];
    const percentageData: number[] = [];

    sortedData.forEach((item) => {
      if (
        item.dimensions?.url &&
        item.values?.[0]?.average_bandwidth_bytes !== undefined &&
        item.values[0].bandwidth_percentage !== undefined
      ) {
        // Clean up URL for better display (remove GET/POST prefix)
        const url = item.dimensions.url.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/, '');
        labels.push(url);

        // Get bandwidth in MB for better readability
        const bandwidthMB = item.values[0].average_bandwidth_bytes / (1024 * 1024);
        bandwidthData.push(Math.round(bandwidthMB * 100) / 100);

        // Get percentage
        const percentage = item.values[0].bandwidth_percentage * 100;
        percentageData.push(Math.round(percentage * 100) / 100);
      }
    });

    const chartData = {
      labels,
      datasets: [
        {
          label: 'Average Bandwidth (MB)',
          data: bandwidthData,
          backgroundColor: labels.map((_, idx) => getColorForIndex(idx, 0.7)),
          borderColor: labels.map((_, idx) => getColorForIndex(idx)),
          borderWidth: 1,
        },
      ],
    };

    const options = {
      indexAxis: 'y' as const, // Horizontal bar chart
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false, // Hide legend since each bar has different color
        },
        tooltip: {
          callbacks: {
            afterLabel: function (context: TooltipItem<'bar'>) {
              const index = context.dataIndex;
              return `Bandwidth %: ${percentageData[index]}%`;
            },
          },
        },
      },
      scales: {
        x: {
          display: true,
          beginAtZero: true,
          title: {
            display: true,
            text: 'Average Bandwidth (MB)',
          },
          grid: {
            display: true,
            color: 'rgba(0, 0, 0, 0.05)',
          },
        },
        y: {
          display: true,
          grid: {
            display: false,
          },
        },
      },
    };

    // Calculate dynamic height based on number of items (50px per bar minimum)
    const minHeightPerBar = 50;
    const totalHeight = Math.max(400, labels.length * minHeightPerBar);

    return {
      key: 'bandwidth',
      title,
      type: 'bar',
      data: chartData,
      options,
      height: `${totalHeight}px`,
    };
  } catch (error) {
    console.error('Error creating bandwidth chart:', error);
    return null;
  }
}

/**
 * Creates a chart for cache hit ratio data
 */
function createCacheHitRatioChart(dataArray: InsightDataItem[], title: string, isTop: boolean): ChartConfig | null {
  try {
    if (!dataArray || dataArray.length === 0) return null;

    // Sort by cache hit ratio
    const sortedData = [...dataArray].sort((a, b) => {
      const ratioA = a.values?.[0]?.cache_hit_ratio || 0;
      const ratioB = b.values?.[0]?.cache_hit_ratio || 0;
      return isTop ? ratioB - ratioA : ratioA - ratioB;
    });

    const labels: string[] = [];
    const ratioData: number[] = [];

    sortedData.forEach((item) => {
      if (item.dimensions?.url && item.values?.[0]?.cache_hit_ratio !== undefined) {
        const url = item.dimensions.url.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/, '');
        labels.push(url);
        const ratio = item.values[0].cache_hit_ratio * 100;
        ratioData.push(Math.round(ratio * 100) / 100);
      }
    });

    const chartData = {
      labels,
      datasets: [
        {
          label: 'Cache Hit Ratio (%)',
          data: ratioData,
          backgroundColor: labels.map((_, idx) => getColorForIndex(idx, 0.7)),
          borderColor: labels.map((_, idx) => getColorForIndex(idx)),
          borderWidth: 1,
        },
      ],
    };

    const options = {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          display: true,
          beginAtZero: true,
          max: 100,
          title: { display: true, text: 'Cache Hit Ratio (%)' },
          grid: { display: true, color: 'rgba(0, 0, 0, 0.05)' },
        },
        y: { display: true, grid: { display: false } },
      },
    };

    const totalHeight = Math.max(400, labels.length * 50);
    return {
      key: `cache-hit-ratio-${isTop ? 'top' : 'bottom'}`,
      title,
      type: 'bar',
      data: chartData,
      options,
      height: `${totalHeight}px`,
    };
  } catch (error) {
    console.error('Error creating cache hit ratio chart:', error);
    return null;
  }
}

/**
 * Creates a chart for miss rate data
 */
function createMissRateChart(dataArray: InsightDataItem[], title: string): ChartConfig | null {
  try {
    if (!dataArray || dataArray.length === 0) return null;

    const sortedData = [...dataArray].sort((a, b) => {
      const missA = a.values?.[0]?.miss_rate || 0;
      const missB = b.values?.[0]?.miss_rate || 0;
      return missB - missA;
    });

    const labels: string[] = [];
    const missData: number[] = [];

    sortedData.forEach((item) => {
      if (item.dimensions?.url && item.values?.[0]?.miss_rate !== undefined) {
        const url = item.dimensions.url.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/, '');
        labels.push(url);
        const missRate = item.values[0].miss_rate * 100;
        missData.push(Math.round(missRate * 100) / 100);
      }
    });

    const chartData = {
      labels,
      datasets: [
        {
          label: 'Miss Rate (%)',
          data: missData,
          backgroundColor: labels.map((_, idx) => getColorForIndex(idx, 0.7)),
          borderColor: labels.map((_, idx) => getColorForIndex(idx)),
          borderWidth: 1,
        },
      ],
    };

    const options = {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          display: true,
          beginAtZero: true,
          max: 100,
          title: { display: true, text: 'Miss Rate (%)' },
          grid: { display: true, color: 'rgba(0, 0, 0, 0.05)' },
        },
        y: { display: true, grid: { display: false } },
      },
    };

    const totalHeight = Math.max(400, labels.length * 50);
    return { key: 'miss-rate', title, type: 'bar', data: chartData, options, height: `${totalHeight}px` };
  } catch (error) {
    console.error('Error creating miss rate chart:', error);
    return null;
  }
}

/**
 * Creates a chart for requests data
 */
function createRequestsChart(dataArray: InsightDataItem[], title: string): ChartConfig | null {
  try {
    if (!dataArray || dataArray.length === 0) return null;

    const sortedData = [...dataArray].sort((a, b) => {
      const reqA = a.values?.[0]?.request_percentage || 0;
      const reqB = b.values?.[0]?.request_percentage || 0;
      return reqB - reqA;
    });

    const labels: string[] = [];
    const requestData: number[] = [];

    sortedData.forEach((item) => {
      if (item.dimensions?.url && item.values?.[0]?.request_percentage !== undefined) {
        const url = item.dimensions.url.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/, '');
        labels.push(url);
        const percentage = item.values[0].request_percentage * 100;
        requestData.push(Math.round(percentage * 100) / 100);
      }
    });

    const chartData = {
      labels,
      datasets: [
        {
          label: 'Request Percentage (%)',
          data: requestData,
          backgroundColor: labels.map((_, idx) => getColorForIndex(idx, 0.7)),
          borderColor: labels.map((_, idx) => getColorForIndex(idx)),
          borderWidth: 1,
        },
      ],
    };

    const options = {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          display: true,
          beginAtZero: true,
          title: { display: true, text: 'Request Percentage (%)' },
          grid: { display: true, color: 'rgba(0, 0, 0, 0.05)' },
        },
        y: { display: true, grid: { display: false } },
      },
    };

    const totalHeight = Math.max(400, labels.length * 50);
    return { key: 'requests', title, type: 'bar', data: chartData, options, height: `${totalHeight}px` };
  } catch (error) {
    console.error('Error creating requests chart:', error);
    return null;
  }
}

/**
 * Creates a chart for error URL data (4xx/5xx)
 */
function createErrorUrlChart(dataArray: InsightDataItem[], title: string): ChartConfig | null {
  try {
    if (!dataArray || dataArray.length === 0) return null;

    const sortedData = [...dataArray].sort((a, b) => {
      const rateA = a.dimension_attributes?.rate || 0;
      const rateB = b.dimension_attributes?.rate || 0;
      return rateB - rateA;
    });

    const labels: string[] = [];
    const rateData: number[] = [];

    sortedData.forEach((item) => {
      if (item.dimensions?.url && item.dimension_attributes?.rate !== undefined) {
        const url = item.dimensions.url.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/, '');
        labels.push(url);
        const rate = item.dimension_attributes.rate * 100;
        rateData.push(Math.round(rate * 100) / 100);
      }
    });

    const chartData = {
      labels,
      datasets: [
        {
          label: 'Error Rate (%)',
          data: rateData,
          backgroundColor: labels.map((_, idx) => getColorForIndex(idx, 0.7)),
          borderColor: labels.map((_, idx) => getColorForIndex(idx)),
          borderWidth: 1,
        },
      ],
    };

    const options = {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          display: true,
          beginAtZero: true,
          title: { display: true, text: 'Error Rate (%)' },
          grid: { display: true, color: 'rgba(0, 0, 0, 0.05)' },
        },
        y: { display: true, grid: { display: false } },
      },
    };

    const totalHeight = Math.max(400, labels.length * 50);
    return { key: 'error-urls', title, type: 'bar', data: chartData, options, height: `${totalHeight}px` };
  } catch (error) {
    console.error('Error creating error URL chart:', error);
    return null;
  }
}

/**
 * Creates a chart for content type data
 */
function createContentTypeChart(dataArray: InsightDataItem[], title: string): ChartConfig | null {
  try {
    if (!dataArray || dataArray.length === 0) return null;

    const sortedData = [...dataArray].sort((a, b) => {
      const rateA = a.values?.[0]?.rate || 0;
      const rateB = b.values?.[0]?.rate || 0;
      return rateB - rateA;
    });

    const labels: string[] = [];
    const rateData: number[] = [];

    sortedData.forEach((item) => {
      if (item.dimensions?.content_type && item.values?.[0]?.rate !== undefined) {
        labels.push(item.dimensions.content_type);
        const rate = item.values[0].rate * 100;
        rateData.push(Math.round(rate * 100) / 100);
      }
    });

    const chartData = {
      labels,
      datasets: [
        {
          label: 'Request Rate (%)',
          data: rateData,
          backgroundColor: labels.map((_, idx) => getColorForIndex(idx, 0.7)),
          borderColor: labels.map((_, idx) => getColorForIndex(idx)),
          borderWidth: 1,
        },
      ],
    };

    const options = {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          display: true,
          beginAtZero: true,
          title: { display: true, text: 'Request Rate (%)' },
          grid: { display: true, color: 'rgba(0, 0, 0, 0.05)' },
        },
        y: { display: true, grid: { display: false } },
      },
    };

    const totalHeight = Math.max(400, labels.length * 50);
    return { key: 'content-type', title, type: 'bar', data: chartData, options, height: `${totalHeight}px` };
  } catch (error) {
    console.error('Error creating content type chart:', error);
    return null;
  }
}

/**
 * Creates a chart for device data
 */
function createDeviceChart(dataArray: InsightDataItem[], title: string): ChartConfig | null {
  try {
    if (!dataArray || dataArray.length === 0) return null;

    const sortedData = [...dataArray].sort((a, b) => {
      const rateA = a.values?.[0]?.rate || 0;
      const rateB = b.values?.[0]?.rate || 0;
      return rateB - rateA;
    });

    const labels: string[] = [];
    const rateData: number[] = [];

    sortedData.forEach((item) => {
      if (item.dimensions?.device && item.values?.[0]?.rate !== undefined) {
        labels.push(item.dimensions.device);
        const rate = item.values[0].rate * 100;
        rateData.push(Math.round(rate * 100) / 100);
      }
    });

    const chartData = {
      labels,
      datasets: [
        {
          label: 'Request Rate (%)',
          data: rateData,
          backgroundColor: labels.map((_, idx) => getColorForIndex(idx, 0.7)),
          borderColor: labels.map((_, idx) => getColorForIndex(idx)),
          borderWidth: 1,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: true, grid: { display: false } },
        y: {
          display: true,
          beginAtZero: true,
          title: { display: true, text: 'Request Rate (%)' },
          grid: { display: true, color: 'rgba(0, 0, 0, 0.05)' },
        },
      },
    };

    return { key: 'device', title, type: 'bar', data: chartData, options, height: '400px' };
  } catch (error) {
    console.error('Error creating device chart:', error);
    return null;
  }
}

/**
 * Creates a chart for OS data
 */
function createOsChart(dataArray: InsightDataItem[], title: string): ChartConfig | null {
  try {
    if (!dataArray || dataArray.length === 0) return null;

    const sortedData = [...dataArray].sort((a, b) => {
      const rateA = a.values?.[0]?.rate || 0;
      const rateB = b.values?.[0]?.rate || 0;
      return rateB - rateA;
    });

    const labels: string[] = [];
    const rateData: number[] = [];

    sortedData.forEach((item) => {
      if (item.dimensions?.os && item.values?.[0]?.rate !== undefined) {
        labels.push(item.dimensions.os);
        const rate = item.values[0].rate * 100;
        rateData.push(Math.round(rate * 100) / 100);
      }
    });

    const chartData = {
      labels,
      datasets: [
        {
          label: 'Request Rate (%)',
          data: rateData,
          backgroundColor: labels.map((_, idx) => getColorForIndex(idx, 0.7)),
          borderColor: labels.map((_, idx) => getColorForIndex(idx)),
          borderWidth: 1,
        },
      ],
    };

    const options = {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          display: true,
          beginAtZero: true,
          title: { display: true, text: 'Request Rate (%)' },
          grid: { display: true, color: 'rgba(0, 0, 0, 0.05)' },
        },
        y: { display: true, grid: { display: false } },
      },
    };

    const totalHeight = Math.max(400, labels.length * 50);
    return { key: 'os', title, type: 'bar', data: chartData, options, height: `${totalHeight}px` };
  } catch (error) {
    console.error('Error creating OS chart:', error);
    return null;
  }
}

/**
 * Creates a chart for browser data
 */
function createBrowserChart(dataArray: InsightDataItem[], title: string): ChartConfig | null {
  try {
    if (!dataArray || dataArray.length === 0) return null;

    // Aggregate by browser (sum up all versions)
    const browserMap = new Map<string, number>();

    dataArray.forEach((item) => {
      if (item.dimensions?.browser && item.values?.[0]?.rate !== undefined) {
        const browser = item.dimensions.browser;
        const rate = item.values[0].rate;
        const currentRate = browserMap.get(browser) || 0;
        browserMap.set(browser, currentRate + rate);
      }
    });

    // Convert to array and sort
    const sortedBrowsers = Array.from(browserMap.entries()).sort((a, b) => b[1] - a[1]);

    const labels: string[] = [];
    const rateData: number[] = [];

    sortedBrowsers.forEach(([browser, rate]) => {
      labels.push(browser);
      rateData.push(Math.round(rate * 100 * 100) / 100);
    });

    const chartData = {
      labels,
      datasets: [
        {
          label: 'Request Rate (%)',
          data: rateData,
          backgroundColor: labels.map((_, idx) => getColorForIndex(idx, 0.7)),
          borderColor: labels.map((_, idx) => getColorForIndex(idx)),
          borderWidth: 1,
        },
      ],
    };

    const options = {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          display: true,
          beginAtZero: true,
          title: { display: true, text: 'Request Rate (%)' },
          grid: { display: true, color: 'rgba(0, 0, 0, 0.05)' },
        },
        y: { display: true, grid: { display: false } },
      },
    };

    const totalHeight = Math.max(400, labels.length * 50);
    return { key: 'browser', title, type: 'bar', data: chartData, options, height: `${totalHeight}px` };
  } catch (error) {
    console.error('Error creating browser chart:', error);
    return null;
  }
}

/**
 * Gets a color for chart series based on index
 */
function getColorForIndex(index: number, alpha: number = 1): string {
  const colors: string[] = [
    `rgba(54, 162, 235, ${alpha})`, // Blue
    `rgba(255, 99, 132, ${alpha})`, // Red
    `rgba(75, 192, 192, ${alpha})`, // Teal
    `rgba(255, 159, 64, ${alpha})`, // Orange
    `rgba(153, 102, 255, ${alpha})`, // Purple
    `rgba(255, 205, 86, ${alpha})`, // Yellow
    `rgba(201, 203, 207, ${alpha})`, // Grey
    `rgba(83, 211, 87, ${alpha})`, // Green
  ];
  return colors[index % colors.length] as string;
}

/**
 * Manual refresh handler
 */
function handleRefresh() {
  if (isInsightsEnabled.value) {
    fetchInsights();
  }
}

/**
 * Handle time range change
 */
function handleTimeRangeChange() {
  if (isInsightsEnabled.value) {
    fetchInsights();
  }
}
</script>

<template>
  <Card v-if="isInsightsEnabled">
    <template #title>
      <div class="flex items-center justify-between w-full">
        <span>Insights</span>
        <div class="flex items-center gap-2">
          <Select
            v-model="selectedTimeRange"
            :options="timeRangeOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select time range"
            class="w-[10rem]"
            @change="handleTimeRangeChange"
          />
          <Button
            icon="pi pi-refresh"
            class="p-button-text p-button-secondary"
            :loading="isLoading"
            @click="handleRefresh"
            :disabled="lock"
          />
        </div>
      </div>
    </template>
    <template #content>
      <div v-if="isLoading && !insightsData" class="flex justify-center items-center h-[20rem]">
        <ProgressSpinner />
      </div>

      <div v-else-if="!insightsData" class="flex justify-center items-center h-[20rem] text-gray-500">
        <div class="text-center">
          <i class="pi pi-info-circle text-4xl mb-3"></i>
          <p>No insights data available</p>
          <p class="text-sm mt-2">Click refresh to fetch insights</p>
        </div>
      </div>

      <div v-else-if="charts.size === 0" class="flex justify-center items-center h-[20rem] text-gray-500">
        <div class="text-center">
          <i class="pi pi-chart-line text-4xl mb-3"></i>
          <p>No chart data available</p>
          <p class="text-sm mt-2">The insights response structure may need configuration</p>
          <details class="mt-4 text-left max-w-2xl mx-auto">
            <summary class="cursor-pointer font-semibold">View raw data</summary>
            <pre class="mt-2 p-4 bg-gray-100 rounded overflow-auto max-h-60 text-xs">{{
              JSON.stringify(insightsData, null, 2)
            }}</pre>
          </details>
        </div>
      </div>

      <div v-else class="insights-charts-container">
        <div
          v-for="[key, chartConfig] in Array.from(charts.entries())"
          :key="String(key)"
          class="insight-chart-card mb-4 p-4 border rounded-lg bg-white"
        >
          <h3 class="text-lg font-semibold mb-3">{{ chartConfig.title }}</h3>
          <Chart
            :type="chartConfig.type"
            :data="chartConfig.data"
            :options="chartConfig.options"
            :plugins="chartConfig.type === 'line' ? [verticalLinePlugin] : []"
            :style="{ width: '100%', height: chartConfig.height || '20rem' }"
          />
        </div>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.insights-charts-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.insight-chart-card {
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.chart-container {
  position: relative;
}
</style>
