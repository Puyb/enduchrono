<template>
  <LineChartGenerator
    :chart-options="chartOptions"
    :chart-data="chartData"
    :chart-id="chartId"
    :dataset-id-key="datasetIdKey"
    :plugins="plugins"
    :css-classes="cssClasses"
    :styles="styles"
    :width="width"
    :height="height"
  />
</template>

<script>
import { Line as LineChartGenerator } from 'vue-chartjs/legacy'
import * as _ from 'lodash'

import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  LinearScale,
  CategoryScale,
  PointElement
} from 'chart.js'

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement,
  LinearScale,
  CategoryScale,
  PointElement
)

export default {
  name: 'ToursMinChart',
  components: {
    LineChartGenerator
  },
  props: {
    toursMin: { type: Object, default: () => {} },
    chartId: {
      type: String,
      default: 'line-chart'
    },
    datasetIdKey: {
      type: String,
      default: 'label'
    },
    width: {
      type: Number,
      default: 400
    },
    height: {
      type: Number,
      default: 400
    },
    cssClasses: {
      default: '',
      type: String
    },
    styles: {
      type: Object,
      default: () => {}
    },
    plugins: {
      type: Array,
      default: () => []
    },
    colors: {
      type: Array,
      default: () => []
    },
  },
  data() {
    return {
      chartOptions: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        animation: false,
      }
    }
  },
  computed: {
    chartData() {
      const labels = _.keys(this.toursMin).map(value => `${Math.floor(value / 1000 / 60)}:${String(Math.floor((value / 1000) % 60)).padStart(2, '0')}`)
      const datasets = [
        {
          label: 'Tours/min',
          data: _.values(this.toursMin),
          lineTension: 0.8,
        }
      ]
      return { datasets, labels }
    },
  },
}
</script>
