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
  name: 'NoiseChart',
  components: {
    LineChartGenerator
  },
  props: {
    noise: { type: Array, default: () => [] },
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
      const style = getComputedStyle(document.body);
      const theme = {
        primary: style.getPropertyValue('--primary'),
        warning: style.getPropertyValue('--warning'),
        danger: style.getPropertyValue('--danger'),
        success: style.getPropertyValue('--success'),
        info: style.getPropertyValue('--info'),
        light: style.getPropertyValue('--light'),
        dark: style.getPropertyValue('--dark'),
        secondary: style.getPropertyValue('--secondary'),
      };
      const colors = Object.values(theme)
      const labels = _.keys(this.noise).reverse()
      const datasets = ['Sta', 'Box', 'minSta', 'minBox'].map((key, index) => {
        return {
          label: key,
          borderColor: colors[index],
          backgroundColor: colors[index],
          data: _.map(this.noise, key),
          lineTension: 0.8,
        }
      })
      return { datasets, labels }
    },
  },
}
</script>
