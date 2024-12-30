<script setup lang="ts">
import { inject, ref, onBeforeUnmount, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import Chart from 'primevue/chart';
import ProjectAPIService from './project.service';
import 'chartjs-adapter-date-fns';

// Init
const sampleCount = 20;
const FASTLY_API_TOKEN = inject('FASTLY_API_TOKEN') as string;
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
      borderColor: '#42A5F5',
      tension: 0.01,
    },
  ],
};
const chartOptions = ref({
  animation: false,
  scales: {
    y: {
      min: 0,
      suggestedMax: 2,
      ticks: {
        stepSize: 1,
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
  if (import.meta.env.DEV) {
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
  const projectService = new ProjectAPIService(props.service_id!, FASTLY_API_TOKEN);

  projectService
    .getStat()
    .then((result) => {
      if (result.Data.length > 0) {
        const chart = chartInstance.value.chart;
        if (chart.data.labels.length >= sampleCount) {
          chart.data.labels = chart.data.labels.slice(1);
          chart.data.datasets[0].data = chart.data.datasets[0].data.slice(1);
        }
        chart.data.labels.push(new Date().valueOf());
        chart.data.datasets[0].data.push(result.Data[0].aggregated.requests);
        chart.update();
      }
    })
    .catch((error) => {
      toast.add({ severity: 'error', summary: 'Error', detail: error, life: 3000 });
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
