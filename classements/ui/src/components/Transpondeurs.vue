<template>
  <div class="transpondeurs d-flex flex-column h-100" style="max-height: 100vh;">
    <div class="d-flex flex-column">
      <b-container fluid>
        <b-row>
          <b-col cols="8">
            <b-button-toolbar>
              <b-button-group size="sm">
                <b-button :variant="selection=='transpondeursAll' ? 'info' : ''" @click="selection = 'transpondeursAll'">Tous <b-badge pill variant="light">{{ transpondeursAll.length }}</b-badge></b-button>
                <b-button :variant="selection=='transpondeursActive' ? 'info' : ''" @click="selection = 'transpondeursActive'">Actifs <b-badge pill variant="light">{{ transpondeursActive.length }}</b-badge></b-button>
                <b-button :variant="selection=='transpondeursInactive' ? 'info' : ''" @click="selection = 'transpondeursInactive'">Inactifs <b-badge pill variant="light">{{ transpondeursInactive.length }}</b-badge></b-button>
                <b-button :variant="selection=='transpondeursNeverSeenCourse' ? 'info' : ''" @click="selection = 'transpondeursNeverSeenCourse'">Sans passage course <b-badge pill variant="light">{{ transpondeursNeverSeenCourse.length }}</b-badge></b-button>
                <b-button :variant="selection=='transpondeursNeverSeen' ? 'info' : ''" @click="selection = 'transpondeursNeverSeen'">Sans passage <b-badge pill variant="light">{{ transpondeursNeverSeen.length }}</b-badge></b-button>
                <b-button :variant="selection=='transpondeursUnknown' ? 'info' : ''" @click="selection = 'transpondeursUnknown'">Inconnus <b-badge pill variant="light">{{ transpondeursUnknown.length }}</b-badge></b-button>
              </b-button-group>
              <b-input-group size="sm">
                <b-form-input v-model="search" placeholder="Recherche"></b-form-input>
              </b-input-group>
            </b-button-toolbar>
          </b-col>
          <b-col cols="4">
            <b-pagination
              v-model="currentPage"
              :total-rows="transpondeursSelected.length"
              :per-page="perPage"
              aria-controls="transpondeurs-table"
              first-number
              last-number
              size="sm"
              align="right"
            ></b-pagination>
          </b-col>
        </b-row>
      </b-container>
    </div>
    <div class="d-flex flex-column flex-fill" style="overflow: scroll; position: relative;">
      <b-table id="transpondeurs-table" striped hover small sticky-header="100vh" :items="transpondeursSelected" :fields="fields" :tbody-tr-class="rowClass" :perPage="perPage" :currentPage="currentPage">
        <template #cell(nom)="data">
          {{ $store.state.equipiers[data.item.dossard]?.nom }}
        </template>
        <template #cell(prenom)="data">
          {{ $store.state.equipiers[data.item.dossard]?.prenom }}
        </template>
        <template #cell(equipe)="data">
          <b-link @click="showEquipe(data.item.dossard)">
            {{ $store.state.equipes[String(data.item.dossard).slice(0, -1)]?.nom }}
          </b-link>
        </template>
        <template #cell(categorie)="data">
          {{ $store.state.equipes[String(data.item.dossard).slice(0, -1)]?.categorie }}
        </template>
        <template #cell(passages)="data">
          {{ tours(data.item).length }}
        </template>
        <template #cell(timestamp)="data">
          {{ lastSeen(data.item) }}
        </template>
      </b-table>
    </div>
  </div>
</template>

<script>
import { formatTime } from '../utils'
import { groupBy } from 'lodash'
export default {
  name: 'transpondeurs',
  props: {
    transpondeurs: [],
  },
  data() {
    return {
      perPage: 100,
      currentPage: 1,
      fields: [
        {
          key: 'id',
          sortable: true
        },
        {
          key: 'dossard',
          sortable: true
        },
        {
          key: 'passages',
          sortable: true
        },
        {
          key: 'timestamp',
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
          key: 'nom',
          sortable: true
        },
        {
          key: 'prenom',
          sortable: true
        },
      ],
      selection: 'transpondeursAll',
      search: '',
    }
  },
  computed: {
    transpondeursAll() { return this.$store.state.transpondeurs },
    transpondeursActive() { return this.$store.state.transpondeurs.filter(t => t.dossard && !t.deleted) },
    transpondeursInactive() { return this.$store.state.transpondeurs.filter(t => t.deleted) },
    transpondeursNeverSeenCourse() { return this.$store.state.transpondeurs.filter(t => t.dossard && !this.tours(t).filter(tr => tr.status !== 'ignore').length) },
    transpondeursNeverSeen() { return this.$store.state.transpondeurs.filter(t => t.dossard && !this.tours(t).length) },
    transpondeursUnknown() { return this.$store.state.transpondeurs.filter(t => !t.dossard) },
    transpondeursSelected() {
      const words = this.search.toLowerCase().split(' ').filter(v => v)
      let transpondeurs =  this[this.selection]
      if (!words.length) return transpondeurs
      return transpondeurs.filter(tour => {
        const equipier = this.$store.state.equipiers[tour.dossard]
        const equipe = this.$store.state.equipes[String(tour.dossard).slice(0, -1)]
        const haystack = `${transpondeurs.id} ${tour.dossard} ${equipier?.nom} ${equipier?.prenom} ${equipe?.nom} ${equipe?.categorie}`.toLowerCase()
        return words.every(word => haystack.includes(word))
      })
    } 
  },
  methods: {
    tours(transpondeur) {
      if (!this.toursCache) {
        this.toursCache = groupBy(this.$store.state.tours, 'transpondeur')
        setTimeout(() => {
          delete this.toursCache
        }, 100)
      }
      return this.toursCache[transpondeur.id] || []
    },
    lastSeen(transpondeur) {
      return formatTime(this.tours(transpondeur).slice(-1)[0]?.timestamp)
    },
    rowClass(item, type) {
      if (!item || type !== 'row') return
      if (!item.dossard) return 'table-danger'
      if (item.deleted) return 'table-warning'
    },
    showEquipe(dossard) {
      this.$router.push(`/equipe/${String(dossard).slice(0, -1)}`)
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
@supports (position: sticky) {
  .b-table-sticky-header > :deep(.table.b-table > thead > tr > th) {
    position: sticky !important;
  }
}
</style>
