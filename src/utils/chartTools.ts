import type { Chart as ChartJS, ChartEvent } from 'chart.js';

/**
 * Custom Chart.js plugin for displaying a vertical cursor line
 * Provides interactive feedback when hovering over the chart
 */
export const verticalLinePlugin = {
  id: 'cursorLine',
  /**
   * Event handler for tracking cursor position
   */
  afterEvent(chart: ChartJS, args: { event: ChartEvent & { x: number; type: string } }) {
    const {
      scales: { x },
    } = chart;
    const event = args.event;

    // Check if mouse is within chart area
    if (x && event.x !== undefined) {
      if (event.x >= x.left && event.x <= x.right && event.type !== 'mouseout') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        chart._cursorX = event.x;
      } else if (event.type === 'mouseout' || event.x < x.left || event.x > x.right) {
        // Clear cursor position when mouse leaves chart area
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        chart._cursorX = undefined;
        // Force chart redraw to remove the line
        chart.draw();
      }
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
 * Chart configuration options for real-time charts (seconds resolution)
 * Defines scales, tooltips, legends, and other chart behaviors for live data
 */
export const createRealtimeChartOptions = () => ({
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
         * Custom tooltip label formatter for real-time charts
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
          second: 'HH:mm:ss',
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
 * Chart configuration options for historical charts (days/months/years resolution)
 * Defines scales, tooltips, legends, and other chart behaviors for historical data
 * @param {string} timeUnit - The time unit for the x-axis ('minute', 'hour', 'day', 'month', 'year')
 * @param {number} stepSize - The step size for the time axis
/**
 * Legend click handler that isolates ("solos") the clicked series so only it
 * is shown and the axis rescales to it. Clicking the already-soloed series
 * restores every dataset to its default visibility.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
function soloLegendClick(e: any, legendItem: any, legend: any) {
  // The chart's events include 'mouseup' (for drag-to-zoom), and Chart.js fires
  // the legend onClick on BOTH 'mouseup' and 'click'. Act only on the real
  // click, otherwise the two fires cancel out this toggle.
  if (e && e.type === 'mouseup') return;
  const chart = legend.chart;
  const index = legendItem.datasetIndex;
  const datasets = chart.data.datasets as any[];
  const visibleCount = datasets.reduce((n: number, _ds: any, i: number) => n + (chart.isDatasetVisible(i) ? 1 : 0), 0);
  const isSoloed = visibleCount === 1 && chart.isDatasetVisible(index);
  datasets.forEach((ds: any, i: number) => {
    // Restore each dataset's default visibility when un-soloing, else show only the clicked one.
    chart.setDatasetVisibility(i, isSoloed ? !ds.hidden : i === index);
  });
  chart.update();
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * @param {string} axisTitle - The label for the x-axis (e.g. 'Time (UTC)')
 * @param {boolean} stacked - Whether to stack the count axis / x categories (status-code view)
 */
export const createHistoricalChartOptions = (
  timeUnit: string = 'day',
  stepSize: number = 1,
  axisTitle: string = 'Time',
  stacked: boolean = false,
  valueSuffix: string = '',
  countAxisTitle: string = 'Count',
) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  // mousedown/mouseup are needed by the drag-to-zoom plugin (not in Chart.js defaults).
  events: ['mousemove', 'mouseout', 'click', 'mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend'],
  interaction: {
    mode: 'nearest',
    intersect: true,
  },
  plugins: {
    legend: {
      display: true,
      position: 'right',
      // Click a series to show only it (axis rescales); click again to restore all.
      onClick: soloLegendClick,
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
            // Format count values with unit prefixes and thousands separators
            let formattedValue;
            if (value >= 1000000000) {
              formattedValue = (value / 1000000000).toFixed(1).replace(/\.0$/, '') + 'G';
            } else if (value >= 1000000) {
              formattedValue = (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
            } else if (value >= 1000) {
              formattedValue = (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
            } else {
              formattedValue = value.toLocaleString();
            }
            // Only the primary count axis carries the value suffix (e.g. bytes);
            // the secondary axis (y_cnt2) is a plain count (origin requests).
            const suffix = context.dataset.yAxisID === 'y_cnt' ? valueSuffix : '';
            return `${datasetLabel}: ${formattedValue}${suffix}`;
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
      stacked,
      ticks: {
        /**
         * Custom tick label formatter for count axis
         * @param {number} value - The tick value
         * @returns {string} Formatted tick label with thousands separators and unit prefixes
         */
        callback: function (value: number) {
          // Format with unit prefixes (k, M, G) and thousands separators
          let formatted;
          if (value >= 1000000000) {
            formatted = (value / 1000000000).toFixed(1).replace(/\.0$/, '') + 'G';
          } else if (value >= 1000000) {
            formatted = (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
          } else if (value >= 1000) {
            formatted = (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
          } else {
            formatted = value.toLocaleString();
          }
          return formatted + valueSuffix;
        },
      },
      title: {
        display: true,
        text: countAxisTitle,
      },
    },
    y_per: {
      type: 'linear',
      // display 'auto' -> only shown when a dataset assigned to it is visible.
      display: 'auto',
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
    // Secondary right-hand count axis (e.g. origin request count on the bandwidth view).
    y_cnt2: {
      type: 'linear',
      display: 'auto',
      position: 'right',
      min: 0,
      ticks: {
        callback: function (value: number) {
          if (value >= 1000000000) return (value / 1000000000).toFixed(1).replace(/\.0$/, '') + 'G';
          else if (value >= 1000000) return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
          else if (value >= 1000) return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
          return value.toLocaleString();
        },
      },
      title: {
        display: true,
        text: 'Requests',
      },
      grid: {
        drawOnChartArea: false,
      },
    },
    x: {
      type: 'time',
      stacked,
      time: {
        unit: timeUnit,
        unitStepSize: stepSize,
        displayFormats: {
          second: 'HH:mm:ss',
          minute: 'HH:mm',
          hour: 'HH:mm',
          day: 'MMM dd',
          month: 'MMM yyyy',
          year: 'yyyy',
        },
      },
      title: {
        display: true,
        text: axisTitle,
      },
    },
  },
});

/**
 * Common dataset configuration options for all chart datasets
 * Provides consistent styling across all data series
 */
const commonDatasetOptions = {
  fill: true,
  tension: 0.3,
  borderWidth: 1,
};

/**
 * Creates chart datasets configuration for statistics visualization
 * @param {number} sampleCount - Number of data points to initialize with NaN values
 * @param {object} datasetOverrides - Extra per-dataset options merged into every dataset
 *   (e.g. { pointRadius: 0 } to hide always-on markers). Defaults to none.
 * @returns {Array} Array of dataset configurations for the chart
 */
export const createChartDatasets = (sampleCount: number, datasetOverrides: Record<string, unknown> = {}) => {
  const datasets = [
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
  ];

  // Merge any caller-supplied overrides into every dataset.
  return datasets.map((dataset) => ({ ...dataset, ...datasetOverrides }));
};

/**
 * Creates datasets for the HTTP status-code view (1xx..5xx), styled for a
 * stacked bar chart with Fastly-like colours.
 * @param {number} sampleCount - Number of data points to initialize with NaN values
 * @param {object} datasetOverrides - Extra per-dataset options merged into every dataset
 * @returns {Array} Array of status-code dataset configurations
 */
export const createStatusDatasets = (sampleCount: number, datasetOverrides: Record<string, unknown> = {}) => {
  const series = [
    { label: 'Info (1xx)', color: '#3B82F6' },
    { label: 'Success (2xx)', color: '#22C55E' },
    { label: 'Redirect (3xx)', color: '#EC4899' },
    { label: 'Client Error (4xx)', color: '#F59E0B' },
    { label: 'Server Error (5xx)', color: '#06B6D4' },
  ];

  return series.map((s) => ({
    label: s.label,
    borderColor: s.color,
    backgroundColor: s.color,
    yAxisID: 'y_cnt',
    data: Array.from({ length: sampleCount }).fill(NaN),
    borderWidth: 0,
    // Make adjacent bars touch, like the Fastly service-overview chart.
    barPercentage: 1.0,
    categoryPercentage: 1.0,
    ...datasetOverrides,
  }));
};

/**
 * Creates stacked-bar datasets from an explicit list of {label, color} series
 * (used by the per-class status drill-down views: 3xx / 4xx / 5xx details).
 * @param {Array} series - Series descriptors ({ label, color })
 * @param {number} sampleCount - Number of data points to initialize with NaN values
 * @param {object} datasetOverrides - Extra per-dataset options merged into every dataset
 * @returns {Array} Array of dataset configurations
 */
export const createStatusDetailDatasets = (
  series: { label: string; color: string }[],
  sampleCount: number,
  datasetOverrides: Record<string, unknown> = {},
) => {
  return series.map((s) => ({
    label: s.label,
    borderColor: s.color,
    backgroundColor: s.color,
    yAxisID: 'y_cnt',
    data: Array.from({ length: sampleCount }).fill(NaN),
    borderWidth: 0,
    barPercentage: 1.0,
    categoryPercentage: 1.0,
    ...datasetOverrides,
  }));
};

/**
 * Creates datasets for the bandwidth view: edge (bytes delivered to end users)
 * and origin (bytes received from origin), rendered as line/area series.
 * @param {number} sampleCount - Number of data points to initialize with NaN values
 * @param {object} datasetOverrides - Extra per-dataset options merged into every dataset
 * @returns {Array} Array of bandwidth dataset configurations
 */
export const createBandwidthDatasets = (sampleCount: number, datasetOverrides: Record<string, unknown> = {}) => {
  const byteSeries = [
    { label: 'Edge', color: '#2196F3' },
    { label: 'Origin', color: '#FF7043' },
  ].map((s) => ({
    label: s.label,
    borderColor: s.color,
    backgroundColor: s.color + '20',
    yAxisID: 'y_cnt',
    data: Array.from({ length: sampleCount }).fill(NaN),
    ...commonDatasetOptions,
    ...datasetOverrides,
  }));

  // Origin request count on the secondary (right) count axis, drawn as a dashed line.
  const originRequests = {
    label: 'Origin requests',
    borderColor: '#9C27B0',
    backgroundColor: '#9C27B020',
    yAxisID: 'y_cnt2',
    data: Array.from({ length: sampleCount }).fill(NaN),
    fill: false,
    tension: 0.3,
    borderWidth: 1,
    borderDash: [5, 4],
    ...datasetOverrides,
  };

  return [...byteSeries, originRequests];
};

/**
 * Creates complete chart data configuration with labels and datasets
 * @param {number} sampleCount - Number of data points to initialize
 * @param {object} datasetOverrides - Extra per-dataset options (see createChartDatasets)
 * @returns {object} Complete chart data object with timestamps and datasets
 */
export const createChartData = (sampleCount: number, datasetOverrides: Record<string, unknown> = {}) => {
  const now = Date.now(); // en millisecondes
  const timestamps: number[] = Array.from({ length: sampleCount }, (_, i) => {
    return now - (sampleCount - 1 - i) * 1000;
  });

  return {
    labels: timestamps,
    datasets: createChartDatasets(sampleCount, datasetOverrides),
  };
};

/**
 * @deprecated Use createRealtimeChartOptions() or createHistoricalChartOptions() instead
 * Legacy function for backward compatibility
 */
export const createChartOptions = (timeUnit: string = 'second', stepSize: number = 1) => {
  if (timeUnit === 'second') {
    return createRealtimeChartOptions();
  } else {
    return createHistoricalChartOptions(timeUnit, stepSize);
  }
};
