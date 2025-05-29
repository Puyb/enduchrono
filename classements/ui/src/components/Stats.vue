<template>
  <div>
    <b-container fluid>
      <b-row>
        <b-col cols="4">
          <b-table-simple small>
            <b-tr><b-th>Tours :</b-th><b-td>{{ $store.state.tours.length }}</b-td></b-tr>
          </b-table-simple>
        </b-col>
        <b-col cols="8">
          <ToursMinChart :toursMin="toursMin" />
        </b-col>
      </b-row>
      <b-row>
        <b-col cols="4">
          <b-table-simple small>
            <b-tr variant=primary><b-th>Sta noise:</b-th><b-td>{{ lastNoise.Sta }}</b-td></b-tr>
            <b-tr variant=warning><b-th>Box noise:</b-th><b-td>{{ lastNoise.Box }}</b-td></b-tr>
            <b-tr variant=danger><b-th>Min Sta noise:</b-th><b-td>{{ lastNoise.minSta }}</b-td></b-tr>
            <b-tr variant=success><b-th>Min Box noise:</b-th><b-td>{{ lastNoise.minBox }}</b-td></b-tr>
          </b-table-simple>
        </b-col>
        <b-col cols="8">
          <NoiseChart :noise="$store.state.noise" />
        </b-col>
      </b-row>
    </b-container>
  </div>
</template>

<script>
import ToursMinChart from './ToursMinChart.vue'
import NoiseChart from './NoiseChart.vue'
const MINUTE = 60 * 1000;
export default {
  name: 'Stats',
  components: { ToursMinChart, NoiseChart },
  computed: {
    toursMin() {
      const res = {}
      const tours = this.$store.state.tours.filter(t => !t.status)
      const bucketSize = 1 * MINUTE
      for (const tour of tours) {
        const bucket = Math.floor(tour.timestamp / bucketSize) * bucketSize
        res[bucket] = (res[bucket] || 0) + 1
      }
      return res
    },
    lastNoise() {
      return this.$store.state.noise.slice(-1)[0]
    },
  },
}
</script>
<style>
</style>
