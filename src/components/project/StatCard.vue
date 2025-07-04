<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted } from 'vue';
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

const chartData = {
  labels: [],
  datasets: [
    {
      label: 'Request',
      data: [],
      fill: true,
      borderColor: '#2196F3',
      backgroundColor: '#2196F320',
      tension: 0.1,
      borderWidth: 1,
      yAxisID: 'y_cnt'
    },
    {
      label: 'Hit',
      data: [],
      fill: true,
      borderColor: '#4CAF50',
      backgroundColor: '#4CAF5020',
      tension: 0.01,
      borderWidth: 1,
      yAxisID: 'y_cnt'
    },
    {
      label: 'Error',
      data: [],
      fill: true,
      borderColor: '#F44336',
      backgroundColor: '#F4433620',
      tension: 0.01,
      borderWidth: 1,
      yAxisID: 'y_cnt'
    },
    {
      label: 'Origin offload',
      data: [],
      fill: true,
      borderColor: '#FF7043',
      backgroundColor: '#FF704320',
      tension: 0.01,
      borderWidth: 1,
      yAxisID: 'y_per'
    },
    {
      label: 'Hit ratio',
      data: [],
      fill: true,
      borderColor: '#9C27B0',
      backgroundColor: '#9C27B020',
      tension: 0.01,
      borderWidth: 1,
      yAxisID: 'y_per'
    },
    {
      label: 'Cache Coverage',
      data: [],
      fill: true,
      borderColor: '#00BCD4',
      backgroundColor: '#00BCD420',
      tension: 0.01,
      borderWidth: 1,
      yAxisID: 'y_per'
    },
  ],
};
const chartOptions = ref({
  animation: false,
  scales: {
    y_cnt: {
      type: 'linear',
      display: true,
      position: 'left',
      min: 0,
      suggestedMax: 2,
      ticks: {
        stepSize: 1,
      },
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
      grid: {
        drawOnChartArea: false,
      },
    },
    x: {
      type: 'time',
      // ticks: {
      //   stepSize: 100
      // }
      time: {
        unit: 'second',
        unitStepSize: 1,
        displayFormats: {
          second: 'hh:mm:ss',
        },
      },
    },
  },
});

onMounted(() => {
  if (localStore.isRtApiEnable()) {
    timer.value = setInterval(() => {
      if (!lock.value) {
        getNextStat();
      }
    }, 1000);
  }
});

// Clean up
onBeforeUnmount(() => {
  timer.value = null;
});

function getNextStat() {
  lock.value = true;
  const projectService = new ProjectAPIService(props.service_id!, service_token);

  projectService
    .getStat()
    .then((result) => {
      if (result.Data.length > 0) {
        const chart = chartInstance.value.chart;

        if (chart.data.labels.length >= sampleCount) {
          chart.data.labels = chart.data.labels.slice(1);
          chart.data.datasets[0].data = chart.data.datasets[0].data.slice(1);
          chart.data.datasets[1].data = chart.data.datasets[1].data.slice(1);
          chart.data.datasets[2].data = chart.data.datasets[2].data.slice(1);
          chart.data.datasets[3].data = chart.data.datasets[3].data.slice(1);
          chart.data.datasets[4].data = chart.data.datasets[4].data.slice(1);
          chart.data.datasets[5].data = chart.data.datasets[5].data.slice(1);
        }

        const cnt_request = result.Data[0].aggregated.requests;
        const cnt_hit = result.Data[0].aggregated.hits;
        const cnt_error = result.Data[0].aggregated.errors;
        const cnt_miss = result.Data[0].aggregated.miss;
        const cnt_pass = result.Data[0].aggregated.pass;

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
        chart.data.datasets[2].data.push(cnt_error);
        chart.data.datasets[3].data.push(cnt_origin_offload);
        chart.data.datasets[4].data.push(cnt_hit_ratio);
        chart.data.datasets[5].data.push(cnt_cache_coverage);

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
    <template #title>Real-time statistic</template>
    <template #content>
      <Chart
        type="line"
        ref="chartInstance"
        :data="chartData"
        :options="chartOptions"
        class="h-[30rem]"
      />
    </template>
  </Card>
</template>
