<template>
  <b-modal :visible="visible" title="Historique du transpondeur" hide-footer size="lg" @hidden="$emit('close')">
    <template #modal-title>
      Historique {{ transpondeurId }}
    </template>
    <b-aspect aspect="3:1">
      <LineChartGenerator :chart-options="chartOptions" :chart-data="chartData" />
    </b-aspect>
  </b-modal>
</template>

<script>
import { Line as LineChartGenerator } from 'vue-chartjs/legacy'
import { formatTime } from '../utils'

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
  name: 'TranspondeurChart',
  components: {
    LineChartGenerator
  },
  props: {
    transpondeurId: { default: null },
  },
  data() {
    return {
      tours: [],
      chartOptions: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          y: {
            position: 'left',
            min: 0,
            max: 100,
            title: { display: true, text: 'Signal' },
          },
          y1: {
            position: 'right',
            min: 0,
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Batterie / Détections' },
          },
        },
      },
    }
  },
  computed: {
    visible() { return this.transpondeurId != null },
    chartData() {
      const style = getComputedStyle(document.body)
      const colors = {
        signal: style.getPropertyValue('--info') || '#0000aa',
        detectionCount: style.getPropertyValue('--warning') || '#aa8800',
        battery: style.getPropertyValue('--success') || '#00aa00',
      }
      return {
        labels: this.tours.map(tour => formatTime(tour.timestamp)),
        datasets: [
          {
            label: 'Signal',
            borderColor: colors.signal,
            backgroundColor: colors.signal,
            data: this.tours.map(tour => tour.signal),
            yAxisID: 'y',
          },
          {
            label: 'Détections',
            borderColor: colors.detectionCount,
            backgroundColor: colors.detectionCount,
            data: this.tours.map(tour => tour.detectionCount),
            yAxisID: 'y1',
          },
          {
            label: 'Batterie',
            borderColor: colors.battery,
            backgroundColor: colors.battery,
            data: this.tours.map(tour => tour.battery),
            yAxisID: 'y1',
          },
        ],
      }
    },
  },
  watch: {
    // Tous statuts confondus (doublon/supprime/ignore) : on veut l'historique complet
    // de ce que le transpondeur a emis, pas seulement les tours valides d'une equipe.
    transpondeurId: {
      immediate: true,
      async handler(id) {
        if (id == null) { this.tours = []; return }
        const res = await fetch(`${this.$root.URL}/tours?transpondeur=${encodeURIComponent(id)}&limit=500`)
        const json = await res.json()
        this.tours = json.tours.slice().reverse()
      },
    },
  },
}
</script>
