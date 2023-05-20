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
  name: 'LineChart',
  components: {
    LineChartGenerator
  },
  props: {
    equipiers: { type: Array, default: () => [] },
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
    }
  },
  data() {
    return {
      chartOptions: {
        responsive: true,
        maintainAspectRatio: false
      }
    }
  },
  computed: {
    chartData() {
      const colors = ['#0000aa', '#00aa00', '#aa0000', '#00aaaa', '#aa00aa']
      const labels = []
      const datasets = this.equipiers.map((equipier, index) => {
        return {
          label: `${equipier.dossard} ${equipier.nom} ${equipier.prenom}`,
          backgroundColor: colors[index],
          data: this.$store.state.tours.filter(tour => tour.dossard === equipier.dossard).map((tour, index2) => {
            if (labels.length <= index2) labels.push(index2)
            return tour.duree
          }),
        }
      })

      console.log('datasets', datasets, labels)
      return { datasets, labels }
    },
  },
}
</script>
