<template>
  <div class="tours">
    <b-table striped hover small :items="$store.state.tours" :fields="fields" :tbody-tr-class="rowClass">
      <template #cell(nom)="data">
        {{ $store.state.equipiers[data.item.dossard]?.nom }}
      </template>
      <template #cell(prenom)="data">
        {{ $store.state.equipiers[data.item.dossard]?.prenom }}
      </template>
      <template #cell(equipe)="data">
        {{ $store.state.equipes[String(data.item.dossard).slice(0, -1)]?.nom }}
      </template>
      <template #cell(categorie)="data">
        {{ $store.state.equipes[String(data.item.dossard).slice(0, -1)]?.categorie }}
      </template>
      <template #cell(position_general)="data">
        {{ $store.state.equipes[String(data.item.dossard).slice(0, -1)]?.position_general }}
      </template>
      <template #cell(position_categorie)="data">
        {{ $store.state.equipes[String(data.item.dossard).slice(0, -1)]?.position_categorie }}
      </template>
    </b-table>
  </div>
</template>

<script>
import { formatTime } from '../utils'
export default {
  name: 'Tours',
  props: {
    tours: [],
  },
  data() {
    return {
      fields: [
        {
          key: 'id',
          sortable: true
        },
        {
          key: 'transpondeur',
          sortable: true
        },
        {
          key: 'dossard',
          sortable: true
        },
        {
          key: 'timestamp',
          sortable: true,
          formatter: formatTime
        },
        {
          key: 'duree',
          sortable: true,
          formatter: formatTime
        },
        {
          key: 'equipe',
          sortable: true
        },
        {
          key: 'categorie',
          sortable: true
        },
        {
          key: 'position_general',
          sortable: true
        },
        {
          key: 'position_categorie',
          sortable: true
        },
        {
          key: 'nom',
          sortable: true
        },
        {
          key: 'prenom',
          sortable: true
        },
      ],
    }
  },
  methods: {
    rowClass(item, type) {
      if (!item || type !== 'row') return
      if (!item.dossard) return 'table-danger'
      if (item.duplicate) return 'table-warning'
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>
