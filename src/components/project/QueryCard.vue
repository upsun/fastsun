<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Select from 'primevue/select';
import SelectButton from 'primevue/selectbutton';
import DatePicker from 'primevue/datepicker';
import Card from 'primevue/card';
import Chart from 'primevue/chart';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import 'chartjs-adapter-date-fns';

import { useCredentialsStore } from '@/stores/credentialsStore';
import ProjectAPIService from './project.service';
import { TAB_VALUES, type TabValue } from '@/utils/tabsTools';
import { validateDateRange } from '@/utils/securityUtils';
import {
  formatDateForUrl,
  parseDateFromUrl,
  toDisplayTimestamp,
  toWallClockDate,
  fromWallClock,
  displayUnitForSpan,
  TIME_ZONES,
  type TimeZoneMode,
} from '@/utils/dateTools';
import {
  verticalLinePlugin,
  createHistoricalChartOptions,
  createChartData,
  createStatusDatasets,
  createStatusDetailDatasets,
  createBandwidthDatasets,
} from '@/utils/chartTools';
import { usePluginSDK } from 'pluginapp-sdk-node';

// Router / dependencies
const route = useRoute();
const router = useRouter();
const credentialsStore = useCredentialsStore();
const toast = useToast();
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

  ALL_STATUS_1XX,
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
  /**
   * Unit to append (e.g., 's', 'B', '%')
   */
  unit?: string;
  /**
   * Fixed scale to use (e.g., 'k', 'M', 'G', 'T'); if not set, auto-scaling is applied
   */
  scale?: string;
}

const metricsList: Map<MetricKey, MetricSpec> = new Map([
  // Base count metrics
  [MetricKey.BANDWIDTH, { id: 'bandwidth', label: 'Bandwidth', convert: 1 / 1000000000, unit: 'B', scale: 'G' }],
  [MetricKey.REQUESTS, { id: 'requests', label: 'Requests' }],
  [MetricKey.HITS, { id: 'hits', label: 'Hits' }],
  [MetricKey.PASS, { id: 'pass', label: 'Pass' }],
  [MetricKey.MISS, { id: 'miss', label: 'Miss' }],
  [MetricKey.ERRORS, { id: 'errors', label: 'Errors', tooltip: 'HTTP 5xx+4xx responses' }],

  // Base percentage metrics
  [MetricKey.ORIGIN_OFFLOAD, { id: 'origin_offload', label: 'Origin Offload', unit: '%', convert: 100, decimal: 2 }],
  [MetricKey.HIT_RATIO, { id: 'hit_ratio', label: 'Hit Ratio', unit: '%', decimal: 2 }],
  [MetricKey.CACHE_COVERAGE, { id: 'cache_coverage', label: 'Cache Coverage', unit: '%', decimal: 2 }],

  // Extra metrics
  [MetricKey.ALL_STATUS_1XX, { id: 'all_status_1xx', label: 'All Status 1xx' }],
  [MetricKey.ALL_STATUS_2XX, { id: 'all_status_2xx', label: 'All Status 2xx' }],
  [MetricKey.ALL_STATUS_3XX, { id: 'all_status_3xx', label: 'All Status 3xx' }],
  [MetricKey.ALL_STATUS_4XX, { id: 'all_status_4xx', label: 'All Status 4xx' }],
  [MetricKey.ALL_STATUS_5XX, { id: 'all_status_5xx', label: 'All Status 5xx' }],
  [MetricKey.STATUS_406, { id: 'status_406', label: 'Status 406' }],
  [MetricKey.STATUS_404, { id: 'status_404', label: 'Status 404' }],
  [MetricKey.STATUS_429, { id: 'status_429', label: 'Status 429' }],
  [MetricKey.MISS_TIME, { id: 'miss_time', label: 'Miss Time', convert: 0.01, decimal: 2, unit: 'ms' }],
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

//// Controls (mirrors Fastly's "Data Resolution" + "Time Range" + timezone) ////

type Resolution = 'minute' | 'hour' | 'day';

const RESOLUTIONS: { label: string; value: Resolution }[] = [
  { label: 'Minute', value: 'minute' },
  { label: 'Hour', value: 'hour' },
  { label: 'Day', value: 'day' },
];

// Which family of metrics the chart graphs.
type ViewMode = 'cache' | 'status' | 'status3xx' | 'status4xx' | 'status5xx' | 'bandwidth';
const VIEW_OPTIONS: { label: string; value: ViewMode }[] = [
  { label: 'Cache', value: 'cache' },
  { label: 'HTTP Status', value: 'status' },
  { label: 'Status 3xx', value: 'status3xx' },
  { label: 'Status 4xx', value: 'status4xx' },
  { label: 'Status 5xx', value: 'status5xx' },
  { label: 'Bandwidth', value: 'bandwidth' },
];
const viewMode = ref<ViewMode>('cache');
// Stacked bar views (status aggregate + per-class drill-downs); the rest are line/area charts.
const STACKED_VIEWS: ViewMode[] = ['status', 'status3xx', 'status4xx', 'status5xx'];
const chartType = computed(() => (STACKED_VIEWS.includes(viewMode.value) ? 'bar' : 'line'));

// Rolling time-range presets (each ends at "now"), plus a Custom option.
const TIME_RANGES: { label: string; value: string; ms: number }[] = [
  { label: '5 minutes', value: '5m', ms: 5 * 60_000 },
  { label: '15 minutes', value: '15m', ms: 15 * 60_000 },
  { label: '30 minutes', value: '30m', ms: 30 * 60_000 },
  { label: '1 hour', value: '1h', ms: 60 * 60_000 },
  { label: '4 hours', value: '4h', ms: 4 * 60 * 60_000 },
  { label: '1 day', value: '1d', ms: 24 * 60 * 60_000 },
  { label: '1 week', value: '1w', ms: 7 * 24 * 60 * 60_000 },
  { label: '1 month', value: '1mo', ms: 30 * 24 * 60 * 60_000 },
  { label: 'Custom', value: 'custom', ms: 0 },
];

const TIMEZONE_OPTIONS: { label: string; value: TimeZoneMode }[] = [
  { label: 'UTC', value: TIME_ZONES.UTC },
  { label: 'Local', value: TIME_ZONES.LOCAL },
];

// Fastly rejects "exceedingly large" queries, and minute data is only kept for
// the last 35 days. These guards keep resolution/range combinations valid.
const STEP_MS: Record<Resolution, number> = { minute: 60_000, hour: 3_600_000, day: 86_400_000 };
const MAX_BUCKETS = 5000;
// A resolution coarser than this (fewer buckets) leaves nothing meaningful to
// plot (e.g. Day over a 1-day range = a single bucket), so it is disabled.
const MIN_BUCKETS = 2;
const MINUTE_RETENTION_MS = 35 * 86_400_000;

const resolution = ref<Resolution>('minute');
const timeRange = ref<string>('1d');
const timezone = ref<TimeZoneMode>(TIME_ZONES.UTC);

// Working values for the custom From/To pickers (wall-clock in the selected tz).
const customFrom = ref<Date>(new Date(Date.now() - 86_400_000));
const customTo = ref<Date>(new Date());
// The custom range actually applied (real epoch ms), set on "Apply".
const appliedCustom = ref<[number, number] | null>(null);

const isLoading = ref(false);
// Guard to avoid watchers firing loads during initial hydration.
const initializing = ref(true);
// Guard to batch multi-field state changes (zoom in/out) into a single reload.
const suppressWatchers = ref(false);

// Drag-to-zoom: stack of prior selections so "Reset zoom" can step back out.
const MIN_ZOOM_SPAN_MS = 2 * 60_000;
interface ZoomSnapshot {
  timeRange: string;
  appliedCustom: [number, number] | null;
  resolution: Resolution;
}
const zoomStack = ref<ZoomSnapshot[]>([]);

// Stores the applied custom range rounded to whole seconds — the same precision
// the URL round-trips through (formatDateForUrl floors to seconds). Keeping them
// aligned lets the external-route watcher's dedup match and avoids a redundant
// second reload after a drag-zoom / Apply.
function setAppliedCustom(fromMs: number, toMs: number) {
  appliedCustom.value = [Math.floor(fromMs / 1000) * 1000, Math.floor(toMs / 1000) * 1000];
}

/** Resolves the effective [from, to] epoch range (ms) for the current selection. */
function computeRange(): [number, number] {
  if (timeRange.value === 'custom') {
    if (appliedCustom.value) return appliedCustom.value;
    const now = Date.now();
    return [now - 86_400_000, now];
  }
  const preset = TIME_RANGES.find((r) => r.value === timeRange.value);
  const span = preset?.ms || 86_400_000;
  const now = Date.now();
  return [now - span, now];
}

/** Number of data buckets a resolution would produce over a span. */
function bucketsFor(res: Resolution, span: number): number {
  return span / STEP_MS[res];
}

// Resolutions offered for the current range, disabling combinations that would
// exceed Fastly's query-size limit or the minute-data retention window.
const resolutionOptions = computed(() => {
  const [from, to] = computeRange();
  const span = to - from;
  const now = Date.now();
  return RESOLUTIONS.map((r) => {
    const buckets = bucketsFor(r.value, span);
    let disabled = buckets > MAX_BUCKETS || buckets < MIN_BUCKETS;
    if (r.value === 'minute' && from < now - MINUTE_RETENTION_MS) disabled = true;
    return { ...r, disabled };
  });
});

/**
 * Ensures the selected resolution is valid for the current range; if not,
 * falls back to the finest available one. Returns true if it changed the value.
 */
function ensureValidResolution(): boolean {
  const opts = resolutionOptions.value;
  const current = opts.find((o) => o.value === resolution.value);
  if (current && current.disabled) {
    // Prefer the finest enabled resolution; if none qualifies (e.g. an extreme
    // span), fall back to the coarsest (fewest buckets) to avoid an oversized query.
    const target = opts.find((o) => !o.disabled) ?? opts[opts.length - 1];
    if (target && target.value !== resolution.value) {
      resolution.value = target.value;
      return true;
    }
  }
  return false;
}

//// Chart ////

// chartData is a deliberately plain (non-reactive) object: Chart.js keeps this
// exact reference, renderChart() mutates it in place and calls chart.update()
// directly, and view/option/type changes drive a PrimeVue re-init that reads the
// mutated object. It must NOT be wrapped in ref()/reactive() (that re-introduces
// the Vue-proxy recursion the drag-zoom work had to remove).
//
// Hide always-on point markers (dense per-minute views get noisy); the hovered
// point still re-appears via pointHoverRadius, so tooltips keep working.
const POINT_OVERRIDES = { pointRadius: 0, pointHoverRadius: 4 };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chartData: any = createChartData(6, POINT_OVERRIDES);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cacheDatasets = chartData.datasets as any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const statusDatasets = createStatusDatasets(6, POINT_OVERRIDES) as any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bandwidthDatasets = createBandwidthDatasets(6, POINT_OVERRIDES) as any[];

// Per-class status drill-downs: specific codes plus an "Other Nxx" remainder
// (class total minus the explicit codes), stacked like the Fastly detail views.
type DetailView = 'status3xx' | 'status4xx' | 'status5xx';
const OTHER_COLOR = '#FFC107';
const STATUS_DETAIL: Record<DetailView, { total: string; series: { code: string; label: string; color: string }[] }> = {
  status3xx: {
    total: '3xx',
    series: [
      { code: '301', label: '301', color: '#2196F3' },
      { code: '302', label: '302', color: '#4CAF50' },
      { code: '304', label: '304', color: '#EC4899' },
    ],
  },
  status4xx: {
    total: '4xx',
    series: [
      { code: '400', label: '400', color: '#2196F3' },
      { code: '401', label: '401', color: '#4CAF50' },
      { code: '403', label: '403', color: '#EC4899' },
      { code: '404', label: '404', color: '#9C27B0' },
      { code: '406', label: '406', color: '#00BCD4' },
      { code: '416', label: '416', color: '#795548' },
      { code: '429', label: '429', color: '#F44336' },
    ],
  },
  status5xx: {
    total: '5xx',
    series: [
      { code: '500', label: '500', color: '#2196F3' },
      { code: '501', label: '501', color: '#4CAF50' },
      { code: '502', label: '502', color: '#EC4899' },
      { code: '503', label: '503', color: '#9C27B0' },
      { code: '504', label: '504', color: '#00BCD4' },
      { code: '505', label: '505', color: '#795548' },
      { code: '530', label: '530', color: '#607D8B' },
    ],
  },
};

// Individual status codes captured per data point (union across all classes).
const INDIVIDUAL_STATUS_CODES = (['status3xx', 'status4xx', 'status5xx'] as DetailView[]).flatMap((v) =>
  STATUS_DETAIL[v].series.map((s) => s.code),
);

function buildDetailDatasets(view: DetailView) {
  const cfg = STATUS_DETAIL[view];
  const series = [
    ...cfg.series.map((s) => ({ label: s.label, color: s.color })),
    { label: `Other ${cfg.total}`, color: OTHER_COLOR },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createStatusDetailDatasets(series, 6, POINT_OVERRIDES) as any[];
}
const status3xxDatasets = buildDetailDatasets('status3xx');
const status4xxDatasets = buildDetailDatasets('status4xx');
const status5xxDatasets = buildDetailDatasets('status5xx');
const chartOptions = ref(createHistoricalChartOptions('hour', 1, 'Time (UTC)'));
/** Reference to the Chart component instance */
const chartInstance = ref();

interface RawPoint {
  t: number;
  requests: number;
  hits: number;
  pass: number;
  miss: number;
  errors: number;
  origin_offload: number;
  hit_ratio: number;
  cache_coverage: number;
  // HTTP status-code counts (1xx..5xx)
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  s5: number;
  // Bandwidth in bytes: edge (delivered to clients) and origin (received from origin)
  bwEdge: number;
  bwOrigin: number;
  // Number of requests sent to origin
  originFetches: number;
  // Per-code status counts + class totals ('3xx'/'4xx'/'5xx') for the drill-down views
  statuses: Record<string, number>;
}

// Raw (timezone-independent) data points backing the chart.
const rawData = ref<RawPoint[]>([]);

function axisTitle(): string {
  return `Time (${timezone.value === TIME_ZONES.UTC ? 'UTC' : 'Local'})`;
}

function updateAxis() {
  const [from, to] = computeRange();
  const stacked = STACKED_VIEWS.includes(viewMode.value);
  const isBandwidth = viewMode.value === 'bandwidth';
  const options = createHistoricalChartOptions(
    displayUnitForSpan(to - from),
    1,
    axisTitle(),
    stacked,
    isBandwidth ? 'B' : '',
    isBandwidth ? 'Bandwidth' : 'Count',
  );
  chartOptions.value = options;
}

// Rebuilds the chart datasets from rawData for the current view, applying the tz transform.
function renderChart() {
  if (!chartInstance.value || !chartInstance.value.chart) return;
  const chart = chartInstance.value.chart;
  chart.resize();

  const view = viewMode.value;
  const isDetail = view === 'status3xx' || view === 'status4xx' || view === 'status5xx';
  let datasets: typeof cacheDatasets;
  if (view === 'status') datasets = statusDatasets;
  else if (view === 'bandwidth') datasets = bandwidthDatasets;
  else if (view === 'status3xx') datasets = status3xxDatasets;
  else if (view === 'status4xx') datasets = status4xxDatasets;
  else if (view === 'status5xx') datasets = status5xxDatasets;
  else datasets = cacheDatasets;
  // Swap the active dataset set (kept on the shared chartData so a chart
  // re-init triggered by type/option changes stays consistent).
  chartData.datasets = datasets;

  chartData.labels = [];
  datasets.forEach((dataset) => {
    dataset.data = [];
  });

  rawData.value.forEach((p) => {
    chartData.labels.push(toDisplayTimestamp(p.t, timezone.value));
    if (isDetail) {
      const cfg = STATUS_DETAIL[view as DetailView];
      let sumExplicit = 0;
      cfg.series.forEach((s, idx) => {
        const v = p.statuses[s.code] || 0;
        datasets[idx].data.push(v);
        sumExplicit += v;
      });
      // "Other Nxx" = class total minus the explicit codes (never negative).
      datasets[cfg.series.length].data.push(Math.max(0, (p.statuses[cfg.total] || 0) - sumExplicit));
    } else if (view === 'status') {
      datasets[0].data.push(p.s1);
      datasets[1].data.push(p.s2);
      datasets[2].data.push(p.s3);
      datasets[3].data.push(p.s4);
      datasets[4].data.push(p.s5);
    } else if (view === 'bandwidth') {
      datasets[0].data.push(p.bwEdge);
      datasets[1].data.push(p.bwOrigin);
      datasets[2].data.push(p.originFetches);
    } else {
      datasets[0].data.push(p.requests);
      datasets[1].data.push(p.hits);
      datasets[2].data.push(p.pass);
      datasets[3].data.push(p.miss);
      datasets[4].data.push(p.errors);
      datasets[5].data.push(p.origin_offload);
      datasets[6].data.push(p.hit_ratio);
      datasets[7].data.push(p.cache_coverage);
    }
  });

  if (chart.update) {
    chart.update();
  }
}

// Loads historical data for the current resolution/range and renders it.
const loadHistoricalData = async () => {
  const [fromMs, toMs] = computeRange();
  if (!(fromMs < toMs)) {
    return; // Invalid range
  }

  isLoading.value = true;

  try {
    const projectService = new ProjectAPIService(credentialsStore.getServiceId(), credentialsStore.getServiceToken());

    const fromTimestamp = Math.floor(fromMs / 1000).toString();
    const toTimestamp = Math.floor(toMs / 1000).toString();
    const res = resolution.value;

    // Match the x-axis to the current span and timezone before rendering.
    updateAxis();

    const result = await projectService.getHistoricalData(fromTimestamp, toTimestamp, res);

    const points: RawPoint[] = [];
    const step = STEP_MS[res];

    if (result?.data?.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.data.forEach((data: any, index: number) => {
        const cnt_hit = data.hits || 0;
        const cnt_miss = data.miss || 0;
        const cnt_pass = data.pass || 0;

        // Origin offload comes back as a ratio (0..1) -> percentage.
        const cnt_origin_offload = (data.origin_offload || 0) * 100;

        const cnt_hit_ratio = cnt_hit + cnt_miss > 0 ? (cnt_hit / (cnt_hit + cnt_miss)) * 100 : 0;
        const cnt_cache_coverage =
          cnt_hit + cnt_miss + cnt_pass > 0 ? ((cnt_hit + cnt_miss) / (cnt_hit + cnt_miss + cnt_pass)) * 100 : 0;

        // Prefer the bucket start_time from the API; fall back to contiguous
        // stepping from the 'from' timestamp (buckets are returned in order).
        const t = typeof data.start_time === 'number' ? data.start_time * 1000 : fromMs + index * step;

        // Drill-down views use the `status_Nxx` family (self-consistent with the
        // individual `status_NNN` codes, so the stacked bars sum to the class
        // total). The aggregate "HTTP Status" view uses the broader
        // `all_status_Nxx` family, so the two views' class totals can differ.
        const statuses: Record<string, number> = {};
        INDIVIDUAL_STATUS_CODES.forEach((c) => (statuses[c] = data['status_' + c] || 0));
        statuses['3xx'] = data.status_3xx || 0;
        statuses['4xx'] = data.status_4xx || 0;
        statuses['5xx'] = data.status_5xx || 0;

        points.push({
          t,
          requests: data.requests || 0,
          hits: cnt_hit,
          pass: cnt_pass,
          miss: cnt_miss,
          errors: data.errors || 0,
          origin_offload: cnt_origin_offload,
          hit_ratio: cnt_hit_ratio,
          cache_coverage: cnt_cache_coverage,
          s1: data.all_status_1xx || 0,
          s2: data.all_status_2xx || 0,
          s3: data.all_status_3xx || 0,
          s4: data.all_status_4xx || 0,
          s5: data.all_status_5xx || 0,
          bwEdge: data.bandwidth || 0,
          bwOrigin: (data.origin_fetch_resp_body_bytes || 0) + (data.origin_fetch_resp_header_bytes || 0),
          originFetches: data.origin_fetches || 0,
          statuses,
        });
      });
    }

    rawData.value = points;
    // Chart may still be mounting on the very first load.
    await nextTick();
    renderChart();

    computeCumulatedStat(result);
  } catch (error) {
    console.error('Error loading historical data:', error);
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load historical data.', life: 5000 });
  } finally {
    isLoading.value = false;
  }
};

function computeCumulatedStat(result: { data: Array<Record<string, number>> }) {
  // Reset stats
  cumulatedStat.value = [];

  const metricsArr: Record<MetricKey, number[]> = {} as Record<MetricKey, number[]>;
  const data = result?.data ?? [];

  // Normalize data into arrays for each metric
  metricsList.forEach((metricSpec: MetricSpec, metricKey: MetricKey) => {
    metricsArr[metricKey] = []; // Initialize array
    switch (metricKey) {
      case MetricKey.HIT_RATIO:
        metricsArr[metricKey] = data.map((d) => {
          const hits = d.hits ?? 0;
          const miss = d.miss ?? 0;
          return hits + miss > 0 ? (hits / (hits + miss)) * 100 : 0;
        });
        break;
      case MetricKey.CACHE_COVERAGE:
        metricsArr[metricKey] = data.map((d) => {
          const hits = d.hits ?? 0;
          const miss = d.miss ?? 0;
          const pass = d.pass ?? 0;
          return hits + miss + pass > 0 ? ((hits + miss) / (hits + miss + pass)) * 100 : 0;
        });
        break;

      // All other metrics are direct mappings
      default:
        metricsArr[metricKey] = data.map((d) => d[metricSpec.id] ?? 0);
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

//// Custom range actions ////

// Seeds the custom pickers from the current effective range.
function seedCustomPickers() {
  const [from, to] = appliedCustom.value ?? computeRange();
  customFrom.value = toWallClockDate(from, timezone.value);
  customTo.value = toWallClockDate(to, timezone.value);
}

function setNow() {
  customTo.value = toWallClockDate(Date.now(), timezone.value);
}

function applyCustom() {
  const fromMs = fromWallClock(customFrom.value, timezone.value);
  const toMs = fromWallClock(customTo.value, timezone.value);

  if (!validateDateRange(new Date(fromMs), new Date(toMs))) {
    toast.add({
      severity: 'warn',
      summary: 'Invalid range',
      detail: 'From must be before To, within 2 years, and not in the future.',
      life: 4000,
    });
    return;
  }

  setAppliedCustom(fromMs, toMs);
  syncUrl();
  // If the resolution is no longer valid for this range, the resolution watcher
  // will trigger the reload once it corrects itself.
  if (!ensureValidResolution()) {
    loadHistoricalData();
  }
}

//// Drag-to-zoom ////

// Applies a new [from, to] window in one shot (custom range + finest valid
// resolution) with a single reload, watchers suppressed to avoid a storm.
async function applyWindow(fromMs: number, toMs: number) {
  suppressWatchers.value = true;
  setAppliedCustom(fromMs, toMs);
  timeRange.value = 'custom';
  ensureValidResolution();
  await nextTick();
  suppressWatchers.value = false;

  seedCustomPickers();
  syncUrl();
  await loadHistoricalData();
}

// Called when the user finishes a horizontal drag on the chart. v1/v2 are
// x-axis values (display space, tz-shifted); convert back to real epochs.
function onDragSelect(v1: number, v2: number) {
  const fromMs = fromWallClock(new Date(Math.min(v1, v2)), timezone.value);
  const toMs = fromWallClock(new Date(Math.max(v1, v2)), timezone.value);

  if (!(fromMs < toMs) || toMs - fromMs < MIN_ZOOM_SPAN_MS) return;

  // Remember the current selection so "Reset zoom" can step back out.
  zoomStack.value.push({
    timeRange: timeRange.value,
    appliedCustom: appliedCustom.value ? [...appliedCustom.value] : null,
    resolution: resolution.value,
  });

  applyWindow(fromMs, toMs);
}

// Custom drag-to-zoom plugin (avoids chartjs-plugin-zoom, which recurses over
// Vue's reactive proxies). Draws a selection band while dragging and reloads
// the selected window on release. Same pattern as verticalLinePlugin.
const dragZoomPlugin = {
  id: 'dragZoom',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  afterEvent(chart: any, args: any) {
    const area = chart.chartArea;
    if (!area) return;
    const e = args.event;
    const state = chart._dragZoom || (chart._dragZoom = { dragging: false, startX: 0, currentX: 0 });
    const x = e.x;

    switch (e.type) {
      case 'mousedown':
        if (x >= area.left && x <= area.right && e.y >= area.top && e.y <= area.bottom) {
          state.dragging = true;
          state.startX = x;
          state.currentX = x;
        }
        break;
      case 'mousemove':
        if (state.dragging) {
          state.currentX = Math.max(area.left, Math.min(area.right, x));
          args.changed = true; // request a redraw to update the band
        }
        break;
      case 'mouseup':
        if (state.dragging) {
          state.dragging = false;
          const { startX, currentX } = state;
          chart.draw(); // clear the band
          if (Math.abs(currentX - startX) > 3) {
            const v1 = chart.scales.x.getValueForPixel(startX);
            const v2 = chart.scales.x.getValueForPixel(currentX);
            onDragSelect(v1, v2);
          }
        }
        break;
      case 'mouseout':
        if (state.dragging) {
          state.dragging = false;
          chart.draw();
        }
        break;
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  afterDraw(chart: any) {
    const state = chart._dragZoom;
    if (!state || !state.dragging) return;
    const area = chart.chartArea;
    const ctx = chart.ctx;
    const left = Math.min(state.startX, state.currentX);
    const width = Math.abs(state.currentX - state.startX);
    ctx.save();
    ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
    ctx.fillRect(left, area.top, width, area.bottom - area.top);
    ctx.restore();
  },
};

// Steps back to the selection prior to the last drag-zoom.
async function resetZoom() {
  const prev = zoomStack.value.pop();
  if (!prev) return;

  suppressWatchers.value = true;
  resolution.value = prev.resolution;
  appliedCustom.value = prev.appliedCustom;
  timeRange.value = prev.timeRange;
  await nextTick();
  suppressWatchers.value = false;

  if (timeRange.value === 'custom') seedCustomPickers();
  syncUrl();
  await loadHistoricalData();
}

//// URL synchronisation ////

interface UrlProps {
  from?: string;
  to?: string;
  tab?: TabValue;
}

function single(value: unknown): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' ? v : undefined;
}

// Persists the current selection to the URL (both standalone and console modes).
function syncUrl() {
  const currentTab = single(route.query.tab);
  if (currentTab !== TAB_VALUES.HISTORY) return;

  const query: Record<string, string> = {
    ...(route.query as Record<string, string>),
    tab: TAB_VALUES.HISTORY,
    res: resolution.value,
    range: timeRange.value,
    tz: timezone.value,
    view: viewMode.value,
  };

  if (timeRange.value === 'custom') {
    const [from, to] = computeRange();
    query.from = formatDateForUrl(new Date(from));
    query.to = formatDateForUrl(new Date(to));
  } else {
    delete query.from;
    delete query.to;
  }

  // Console mode.
  sdk.setUrlParams(query);
  // Standalone mode.
  router.replace({ query });
}

// Reads control state from the current URL query.
function hydrateFromUrl() {
  const tz = single(route.query.tz);
  if (tz === TIME_ZONES.UTC || tz === TIME_ZONES.LOCAL) timezone.value = tz;

  const res = single(route.query.res);
  if (res === 'minute' || res === 'hour' || res === 'day') resolution.value = res;

  const view = single(route.query.view);
  if (view && VIEW_OPTIONS.some((o) => o.value === view)) viewMode.value = view as ViewMode;

  const from = single(route.query.from);
  const to = single(route.query.to);
  if (from && to) {
    const fromDate = parseDateFromUrl(from);
    const toDate = parseDateFromUrl(to);
    if (fromDate && toDate && validateDateRange(fromDate, toDate)) {
      timeRange.value = 'custom';
      setAppliedCustom(fromDate.getTime(), toDate.getTime());
      return;
    }
  }

  const range = single(route.query.range);
  if (range && TIME_RANGES.some((r) => r.value === range)) {
    timeRange.value = range;
  }
}

onMounted(async () => {
  hydrateFromUrl();

  // Console mode: dates may arrive from the host component instead of the URL.
  if (!route.query.from && !route.query.to) {
    try {
      const urlProps = await sdk.getUrlParams<UrlProps>();
      if (urlProps?.from && urlProps?.to) {
        const fromDate = parseDateFromUrl(String(urlProps.from));
        const toDate = parseDateFromUrl(String(urlProps.to));
        if (fromDate && toDate && validateDateRange(fromDate, toDate)) {
          timeRange.value = 'custom';
          setAppliedCustom(fromDate.getTime(), toDate.getTime());
        }
      }
    } catch {
      // No external dates available.
    }
  }

  if (timeRange.value === 'custom') seedCustomPickers();
  ensureValidResolution();
  await loadHistoricalData();

  // Allow watchers to react to user changes after initial setup.
  await nextTick();
  initializing.value = false;
});

//// Watchers ////

watch(resolution, () => {
  if (initializing.value || suppressWatchers.value) return;
  zoomStack.value = []; // an explicit resolution change supersedes the zoom history
  syncUrl();
  loadHistoricalData();
});

watch(timeRange, (value) => {
  if (initializing.value || suppressWatchers.value) return;
  zoomStack.value = []; // an explicit range change supersedes the zoom history
  if (value === 'custom') {
    seedCustomPickers();
    return; // Wait for the user to Apply.
  }
  syncUrl();
  if (!ensureValidResolution()) {
    loadHistoricalData();
  }
});

watch(timezone, () => {
  if (initializing.value || suppressWatchers.value) return;
  // Timezone only affects display: re-render the chart and reformat pickers.
  updateAxis();
  renderChart();
  if (timeRange.value === 'custom') seedCustomPickers();
  syncUrl();
});

watch(viewMode, () => {
  if (initializing.value || suppressWatchers.value) return;
  // Same data, different series/chart type: no refetch needed.
  updateAxis();
  renderChart();
  syncUrl();
});

// React to external date changes (e.g. the Upsun console) on the History tab.
watch(
  () => [route.query.tab, route.query.from, route.query.to],
  async () => {
    if (initializing.value || suppressWatchers.value) return;
    const currentTab = single(route.query.tab);
    if (currentTab !== TAB_VALUES.HISTORY) return;

    const from = single(route.query.from);
    const to = single(route.query.to);
    if (!from || !to) return;

    const fromDate = parseDateFromUrl(from);
    const toDate = parseDateFromUrl(to);
    if (!fromDate || !toDate || !validateDateRange(fromDate, toDate)) return;

    // Compare against the rounded (second-aligned) applied range so a URL update
    // we just wrote via syncUrl() doesn't re-trigger a load here.
    const next: [number, number] = [Math.floor(fromDate.getTime() / 1000) * 1000, Math.floor(toDate.getTime() / 1000) * 1000];
    const current = appliedCustom.value;
    if (current && current[0] === next[0] && current[1] === next[1]) return;

    timeRange.value = 'custom';
    setAppliedCustom(next[0], next[1]);
    seedCustomPickers();
    // If the resolution needs correcting, the resolution watcher reloads;
    // otherwise load here (avoids a double fetch), matching the other paths.
    if (!ensureValidResolution()) {
      await loadHistoricalData();
    }
  },
);

/**
 * Formats a numeric value without decimals and with thousands separator
 */
function format_int(value: number | string, spec: MetricSpec): string {
  if (value === null || value === undefined || isNaN(Number(value))) return '';

  let num: number = Number(value);
  const unit: string = spec.unit ? spec.unit : '';
  let scale: string = spec.scale ? spec.scale : '';
  let convert: number = spec.convert ? spec.convert : 0;
  let decimal: number = spec.decimal ? spec.decimal : 0;

  // If convert is null, auto-scale
  if (convert === null) {
    if (Math.abs(num) >= 1e12) {
      num = num / 1e12;
      scale = ' T';
      decimal = 2;
    } else if (Math.abs(num) >= 1e9) {
      num = num / 1e9;
      scale = ' G';
      decimal = 2;
    } else if (Math.abs(num) >= 1e6) {
      num = num / 1e6;
      scale = ' M';
      decimal = 2;
    } else if (Math.abs(num) >= 1e3) {
      num = num / 1e3;
      scale = ' k';
      decimal = 2;
    }
    // else: keep as is, no scale
  } else {
    if (!convert || isNaN(convert) || convert === 0) convert = 1;
    num = num * convert;
  }

  return num.toLocaleString('fr-FR', { maximumFractionDigits: decimal }) + ' ' + scale + unit;
}
</script>

<template>
  <Card>
    <template #title>Historical statistics</template>
    <template #content>
      <div class="history-controls">
        <div class="control">
          <label class="control-label">Metric</label>
          <Select v-model="viewMode" :options="VIEW_OPTIONS" optionLabel="label" optionValue="value" />
        </div>
        <div class="control">
          <label class="control-label">Data Resolution</label>
          <Select
            v-model="resolution"
            :options="resolutionOptions"
            optionLabel="label"
            optionValue="value"
            optionDisabled="disabled"
          />
        </div>
        <div class="control">
          <label class="control-label">Time Range</label>
          <Select v-model="timeRange" :options="TIME_RANGES" optionLabel="label" optionValue="value" />
        </div>
        <div class="control">
          <label class="control-label">Time zone</label>
          <SelectButton
            v-model="timezone"
            :options="TIMEZONE_OPTIONS"
            optionLabel="label"
            optionValue="value"
            :allowEmpty="false"
          />
        </div>
        <div v-if="isLoading" class="control loading-inline">
          <i class="pi pi-spin pi-spinner" style="font-size: 1.2rem; color: var(--p-primary-color)"></i>
        </div>
      </div>

      <div v-if="timeRange === 'custom'" class="custom-range">
        <div class="cr-field">
          <label class="control-label">From</label>
          <DatePicker v-model="customFrom" showTime hourFormat="24" :manualInput="true" showIcon />
        </div>
        <div class="cr-field">
          <label class="control-label">To</label>
          <div class="cr-to">
            <DatePicker v-model="customTo" showTime hourFormat="24" :manualInput="true" showIcon />
            <Button label="Now" text size="small" @click="setNow" />
          </div>
        </div>
        <Button label="Apply" size="small" @click="applyCustom" />
      </div>

      <div class="chart-spacer"></div>
      <div class="chart-toolbar">
        <span class="chart-hint"><i class="pi pi-search-plus"></i> Drag across the chart to zoom into a time window</span>
        <Button
          v-if="zoomStack.length > 0"
          label="Reset zoom"
          icon="pi pi-refresh"
          size="small"
          text
          @click="resetZoom"
        />
      </div>
      <Chart
        :type="chartType"
        ref="chartInstance"
        :data="chartData"
        :options="chartOptions"
        :plugins="[verticalLinePlugin, dragZoomPlugin]"
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
                <span v-if="slotProps.data.unit"> ({{ slotProps.data.unit }})</span>
              </span>
            </template>
          </Column>
          <Column field="cumulated" header="Total" sortable style="text-align: right">
            <template #body="slotProps">
              <span v-if="slotProps.data.unit !== '%'">
                {{ format_int(slotProps.data.cumulated, slotProps.data) }}
              </span>
            </template>
          </Column>
          <Column field="avg" header="Average" sortable style="text-align: right">
            <template #body="slotProps">
              <span>{{ format_int(slotProps.data.avg, slotProps.data) }}</span>
            </template>
          </Column>
          <Column field="min" header="Min" sortable style="text-align: right">
            <template #body="slotProps">
              <span>{{ format_int(slotProps.data.min, slotProps.data) }}</span>
            </template>
          </Column>
          <Column field="max" header="Max" sortable style="text-align: right">
            <template #body="slotProps">
              <span>{{ format_int(slotProps.data.max, slotProps.data) }}</span>
            </template>
          </Column>
          <Column field="percentile95" header="95th Percentile" sortable style="text-align: right">
            <template #body="slotProps">
              <span>{{ format_int(slotProps.data.percentile95, slotProps.data) }}</span>
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.history-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem;
}

.control {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.control-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--p-text-muted-color, #6b7280);
}

.loading-inline {
  justify-content: flex-end;
  padding-bottom: 0.4rem;
}

.custom-range {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem;
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid var(--p-content-border-color, #e5e7eb);
  border-radius: 8px;
}

.cr-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.cr-to {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chart-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  min-height: 2rem;
}

.chart-hint {
  font-size: 0.8rem;
  color: var(--p-text-muted-color, #6b7280);
}

.chart-hint i {
  margin-right: 0.3rem;
}
</style>
