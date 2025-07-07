<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import Chart from 'primevue/chart';
import ProjectAPIService from './project.service';
import 'chartjs-adapter-date-fns';
import LocalStore from '@/stores/localStorage';

// Init
const localStore = new LocalStore()
const service_token = localStore.getFastlyToken() || '';
const sampleCount = 60;
const toast = useToast();
const props = defineProps({
  service_id: {
    type: String,
    required: true,
  },
});

// Data
const timer = ref();
const lock = ref<boolean>(false);
const chartInstance = ref();

const subOption = {
  fill: true,
  tension: 0.3,
  borderWidth: 1,
}

const chartData = {
  labels: [],
  datasets: [
    {
      label: 'Request',
      borderColor: '#2196F3',
      backgroundColor: '#2196F320',
      yAxisID: 'y_cnt',
      ...subOption,
    },
    {
      label: 'Hit',
      borderColor: '#4CAF50',
      backgroundColor: '#4CAF5020',
      yAxisID: 'y_cnt',
      ...subOption
    },
    {
      label: 'Pass',
      borderColor: '#9C27B0',
      backgroundColor: '#9C27B020',
      yAxisID: 'y_cnt',
      ...subOption
    },
    {
      label: 'Miss',
      borderColor: '#FF7043',
      backgroundColor: '#FF704320',
      yAxisID: 'y_cnt',
      ...subOption
    },
    {
      label: 'Error',
      borderColor: '#F44336',
      backgroundColor: '#F4433620',
      yAxisID: 'y_cnt',
      ...subOption
    },
    {
      label: 'Origin offload',
      borderColor: '#FF7043',
      backgroundColor: '#FF704320',
      yAxisID: 'y_per',
      hidden: true,
      ...subOption
    },
    {
      label: 'Hit ratio',
      borderColor: '#9C27B0',
      backgroundColor: '#9C27B020',
      yAxisID: 'y_per',
      hidden: true,
      ...subOption
    },
    {
      label: 'Cache Coverage',
      borderColor: '#00BCD4',
      backgroundColor: '#00BCD420',
      yAxisID: 'y_per',
      hidden: true,
      ...subOption
    },
  ],
};

const verticalLinePlugin = {
  id: 'cursorLine',
  afterEvent(chart, args) {
    const {ctx, chartArea: {top, bottom}, scales: {x}} = chart;
    const event = args.event;

    if (event.x >= x.left && event.x <= x.right) {
      chart._cursorX = event.x;
    }
  },
  afterDraw(chart) {
    const {ctx, chartArea: {top, bottom}, _cursorX} = chart;
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
  }
};

const chartOptions = ref({
  animation: false,
  interaction: {
    mode: 'nearest',
    intersect: false,
  },
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        boxWidth: 12,
        padding: 10,
        font: {
          size: 11
        },
        usePointStyle: true,
        pointStyle: 'rect'
      }
    },
    tooltip: {
      callbacks: {
        label: function(context: { dataset: { label: string; yAxisID: string }; parsed: { y: number } }) {
          const datasetLabel = context.dataset.label || '';
          const value = context.parsed.y;

          // Add appropriate unit based on the dataset
          if (context.dataset.yAxisID === 'y_per') {
            return `${datasetLabel}: ${value.toFixed(2)}%`;
          } else {
            return `${datasetLabel}: ${value} req`;
          }
        }
      },
      mode: 'index',
      intersect: false,
    }
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
        callback: function(value: number) {
          return value + ' req';
        }
      },
      title: {
        display: true,
        text: 'Count'
      }
    },
    y_per: {
      type: 'linear',
      display: true,
      position: 'right',
      min: 0,
      max: 100,
      ticks: {
        callback: function(value: number) {
          return value + '%';
        }
      },
      title: {
        display: true,
        text: 'Percentage'
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
        text: 'Time'
      }
    },
  },
});

const icon = computed(() => (timer.value ? 'pi pi-pause-circle' : 'pi pi-play-circle'));

onMounted(() => {
  startData();
});

// Clean up
onBeforeUnmount(() => {
  pauseData();
});

function pauseResume() {
  if (timer.value) {
    pauseData();
  } else {
    startData();
  }
}

function pauseData() {
  if (timer.value) {
    clearInterval(timer.value);
    timer.value = null;
  }
}

function startData() {
  if (!timer.value) {
    timer.value = setInterval(() => {
      if (!lock.value) {
        getNextStat();
      }
    }, 1000);
  }
}

function getNextStat() {
  lock.value = true;
  const projectService = new ProjectAPIService(props.service_id!, service_token);

  projectService
    .getStat()
    .then((result) => {
      if (result.Data.length > 0) {
        const chart = chartInstance.value.chart;

        // Slice old value, to append new one.
        if (chart.data.labels.length >= sampleCount) {
          chart.data.labels = chart.data.labels.slice(1);
            chart.data.datasets.forEach((dataset: { data: string; }, _idx: number) => {
            dataset.data = dataset.data.slice(1);
            });
        }

        const cnt_request = result.Data[0].aggregated.requests || 0;
        const cnt_hit = result.Data[0].aggregated.hits || 0;
        const cnt_error = result.Data[0].aggregated.errors || 0;
        const cnt_miss = result.Data[0].aggregated.miss || 0;
        const cnt_pass = result.Data[0].aggregated.pass || 0;


        let cnt_origin_offload = result.Data[0].aggregated.origin_offload*100;
        if (!cnt_origin_offload) {
          cnt_origin_offload = 0;
        }

        let cnt_hit_ratio = 0;
        if (cnt_hit+cnt_miss > 0) {
          cnt_hit_ratio = (cnt_hit/(cnt_hit+cnt_miss))*100;
        }

        let cnt_cache_coverage = 0;
        if ((cnt_hit+cnt_miss+cnt_pass) > 0) {
          cnt_cache_coverage = ((cnt_hit+cnt_miss)/(cnt_hit+cnt_miss+cnt_pass))*100;
        }

        chart.data.labels.push(new Date().valueOf());
        chart.data.datasets[0].data.push(cnt_request);
        chart.data.datasets[1].data.push(cnt_hit);
        chart.data.datasets[2].data.push(cnt_pass);
        chart.data.datasets[3].data.push(cnt_miss);
        chart.data.datasets[4].data.push(cnt_error);
        chart.data.datasets[5].data.push(cnt_origin_offload);
        chart.data.datasets[6].data.push(cnt_hit_ratio);
        chart.data.datasets[7].data.push(cnt_cache_coverage);

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
    <template #title>Real-time statistic
      <Button
        :icon="icon"
        class="p-button-text p-button-secondary"
        @click="pauseResume"
      />
    </template>
    <template #content>
      <Chart
        type="line"
        ref="chartInstance"
        :data="chartData"
        :options="chartOptions"
        :plugins="[verticalLinePlugin]"
        class="h-[40rem] w-full"
      />
    </template>
  </Card>
</template>
