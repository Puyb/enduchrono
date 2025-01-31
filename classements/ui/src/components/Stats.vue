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
    </b-container>
  </div>
</template>

<script>
import ToursMinChart from './ToursMinChart.vue'
const MINUTE = 60 * 1000;
export default {
  name: 'Stats',
  components: { ToursMinChart },
  computed: {
    toursMin() {
      const res = {}
      const tours = this.$store.state.tours.filter(t => !t.status)
      console.log('tours', tours.length)
      const bucketSize = 1 * MINUTE
      for (const tour of tours) {
        const bucket = Math.floor(tour.timestamp / bucketSize) * bucketSize
        res[bucket] = (res[bucket] || 0) + 1
      }
      console.log('res', res)
      return res
    },
  },
}
</script>
<style>
</style>
