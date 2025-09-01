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
export const createChartOptions = () => ({
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
 * @returns {Array} Array of dataset configurations for the chart
 */
export const createChartDatasets = (sampleCount: number) => [
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

/**
 * Creates complete chart data configuration with labels and datasets
 * @param {number} sampleCount - Number of data points to initialize
 * @returns {object} Complete chart data object with timestamps and datasets
 */
export const createChartData = (sampleCount: number) => {
  const now = Date.now(); // en millisecondes
  const timestamps: number[] = Array.from({ length: sampleCount }, (_, i) => {
    return now - (sampleCount - 1 - i) * 1000;
  });

  return {
    labels: timestamps,
    datasets: createChartDatasets(sampleCount),
  };
};
