<template>
  <div class="logs d-flex flex-column h-100" style="max-height: 100vh;">
    <b-container fluid class="mb-2">
      <b-row>
        <b-col>
          <b-button size="sm" @click="fetchLogs">Rafraîchir</b-button>
        </b-col>
      </b-row>
    </b-container>
    <div class="d-flex flex-column flex-fill" style="overflow: scroll;">
      <LogsTable :logs="logs" />
    </div>
  </div>
</template>

<script>
import LogsTable from './LogsTable.vue'
export default {
  name: 'Logs',
  components: { LogsTable },
  data() {
    return {
      logs: [],
    }
  },
  mounted() {
    this.fetchLogs()
  },
  methods: {
    async fetchLogs() {
      const res = await fetch(`${this.$root.URL}/logs`)
      const json = await res.json()
      this.logs = json.logs
    },
  },
}
</script>
