<template>
  <b-table striped hover small :items="logs" :fields="fields" sticky-header="100vh">
    <template #cell(timestamp)="data">
      {{ formatDateTime(data.item.timestamp) }}
    </template>
    <template #cell(elapsed)="data">
      {{ formatTime(data.item.elapsed) }}
    </template>
    <template #cell(equipe)="data">
      <b-link v-if="data.item.equipe != null" @click="showEquipe(data.item.equipe)">
        {{ data.item.equipe }} - {{ $store.state.equipes[data.item.equipe]?.nom }}
      </b-link>
    </template>
    <template #cell(data)="data">
      <pre class="mb-0 log-data">{{ formatData(data.item.data) }}</pre>
    </template>
  </b-table>
</template>

<script>
import { formatTime, formatDateTime } from '../utils'
export default {
  name: 'LogsTable',
  props: {
    logs: { type: Array, default: () => [] },
    fields: {
      type: Array,
      default: () => ([
        { key: 'timestamp', label: 'Date/heure', sortable: true },
        { key: 'elapsed', label: 'Temps écoulé', sortable: true },
        { key: 'action', label: 'Action', sortable: true },
        { key: 'object_type', label: 'Type' },
        { key: 'object_id', label: 'Id' },
        { key: 'equipe', label: 'Équipe' },
        { key: 'data', label: 'Données' },
      ]),
    },
  },
  methods: {
    formatTime,
    formatDateTime,
    formatData(data) {
      return data ? JSON.stringify(data) : ''
    },
    showEquipe(equipe) {
      this.$router.push(`/equipe/${equipe}`)
    },
  },
}
</script>

<style scoped>
.log-data {
  font-size: 0.8em;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
