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
const sampleCount = 20;
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
  if (localStore.isRtApiEnable()) {
    timer.value = setInterval(() => {
      if (!lock.value) {
        getNextStat();
      }
    }, 2000);
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
        }
        chart.data.labels.push(new Date().valueOf());
        chart.data.datasets[0].data.push(result.Data[0].aggregated.requests);
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
