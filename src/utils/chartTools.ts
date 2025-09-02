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
 * @param {string} timeUnit - The time unit for the x-axis ('day', 'month', 'year')
 * @param {number} stepSize - The step size for the time axis
 */
export const createHistoricalChartOptions = (timeUnit: string = 'day', stepSize: number = 1) => ({
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
            return `${datasetLabel}: ${formattedValue}`;
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
      ticks: {
        /**
         * Custom tick label formatter for count axis
         * @param {number} value - The tick value
         * @returns {string} Formatted tick label with thousands separators and unit prefixes
         */
        callback: function (value: number) {
          // Format with unit prefixes (k, M, G) and thousands separators
          if (value >= 1000000000) {
            return (value / 1000000000).toFixed(1).replace(/\.0$/, '') + 'G';
          } else if (value >= 1000000) {
            return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
          } else if (value >= 1000) {
            return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
          } else {
            return value.toLocaleString();
          }
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
