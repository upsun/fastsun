<script setup lang="ts">
import { inject, ref, onBeforeUnmount, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import Chart from 'primevue/chart';
import ProjectAPIService from './project.api';
import 'chartjs-adapter-date-fns';

// Init
const sampleCount = 20;
const FASTLY_API_TOKEN = inject('FASTLY_API_TOKEN') as String;
const toast = useToast();
const props = defineProps({
  service_id: String,
  vcl_version: Number
});

// Data
const timer = ref();
const lock = ref();
const chartInstance = ref();
const s = new Date().valueOf();
const chartData = {
  labels: [],
  datasets: [
    {
      label: 'Request',
      data: [],
      fill: true,
      borderColor: '#42A5F5',
      tension: .01
    }
  ]
};
const chartOptions = ref({
  animation: false,
  scales: {
    y: {
      min: 0,
      suggestedMax: 2,
      ticks: {
        stepSize: 1
      }
    },
    x: {
      type: 'time',
      // ticks: {
      //   stepSize: 100
      // }
    }
  }
});

onMounted(() => {
  timer.value = setInterval(() => {
    if (!lock.value) {
      getNextStat();
    }
  }, 1000);
});

// Clean up
onBeforeUnmount(() => {
  timer.value = null;
});

function getNextStat() {
  lock.value = true;
  const projectService = new ProjectAPIService(props.service_id!, FASTLY_API_TOKEN);

  projectService.getStat()
  .catch(error => {
    console.error(error);
    toast.add({ severity: 'error', summary: 'Error', detail: error, life: 3000 });
  })
  .then(result => {
    const [error, data] = result;

    if (data.Data.length > 0) {
      const chart = chartInstance.value.chart;
      if (chart.data.labels.length >= sampleCount) {
        chart.data.labels = chart.data.labels.slice(1);
        chart.data.datasets[0].data = chart.data.datasets[0].data.slice(1);
      }
      chart.data.labels.push(new Date().valueOf());
      chart.data.datasets[0].data.push(data.Data[0].aggregated.requests)
      chart.update()
    }
  }).finally(() => {
    lock.value = false;
  });
};


</script>

<template>
  <Card>
    <template #title>Real-time statistic</template>
    <template #content>
      <Chart type="line" ref="chartInstance" :data="chartData" :options="chartOptions" class="h-[30rem]" />
    </template>
  </Card>
</template>
