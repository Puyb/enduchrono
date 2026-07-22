<template>
  <div class="d-flex flex-column h-100" style="max-height: 100vh;">
    <div class="d-flex flex-column">
      <b-container fluid>
        <b-row>
          <b-col cols="8">
            <b-button-toolbar>
              <b-button-group size="sm">
                <b-button :variant="selection=='toursAll' ? 'info' : ''" @click="selection = 'toursAll'">Tous <b-badge pill variant="light">{{ toursCounts.all }}</b-badge></b-button>
                <b-button :variant="selection=='toursNormaux' ? 'info' : ''" @click="selection = 'toursNormaux'">Normaux <b-badge pill variant="light">{{ toursCounts.normaux }}</b-badge></b-button>
                <b-button :variant="selection=='toursDuplicate' ? 'info' : ''" @click="selection = 'toursDuplicate'">Dupliqués <b-badge pill variant="light">{{ toursCounts.duplicate }}</b-badge></b-button>
                <b-button :variant="selection=='toursDeleted' ? 'info' : ''" @click="selection = 'toursDeleted'">Supprimés <b-badge pill variant="light">{{ toursCounts.deleted }}</b-badge></b-button>
                <b-button :variant="selection=='toursUnknown' ? 'info' : ''" @click="selection = 'toursUnknown'">Inconnus <b-badge pill variant="light">{{ toursCounts.unknown }}</b-badge></b-button>
              </b-button-group>
              <b-input-group size="sm">
                <b-form-input v-model="search" placeholder="Recherche"></b-form-input>
              </b-input-group>
              <b-button v-if="newToursSincePage1 > 0" size="sm" variant="warning" class="ml-2" @click="resetToLive()">
                {{ newToursSincePage1 }} nouveau{{ newToursSincePage1 > 1 ? 'x' : '' }} tour{{ newToursSincePage1 > 1 ? 's' : '' }}
              </b-button>
            </b-button-toolbar>
          </b-col>
          <b-col cols="4">
            <b-pagination
              v-model="currentPage"
              :total-rows="totalRows"
              :per-page="perPage"
              aria-controls="tour-table"
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
      <ToursTable :tours="displayedTours" :fields="fields" :perPage="tablePerPage" :currentPage="tableCurrentPage"/>
    </div>
  </div>
</template>

<script>
import ToursTable from './ToursTable.vue'

const SELECTION_TO_STATUS = {
  toursAll: 'all',
  toursNormaux: 'normaux',
  toursDuplicate: 'duplicate',
  toursDeleted: 'deleted',
  toursUnknown: 'unknown',
}

export default {
  name: 'Tours',
  components: { ToursTable },
  props: {
    tours: [],
  },
  data() {
    return {
      perPage: 100,
      currentPage: 1,
      fields: [
        {
          key: 'numero',
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
        },
        {
          key: 'duree',
          sortable: true,
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
      selection: 'toursAll',
      search: '',
      frozenTours: [],
      frozenHasMore: false,
      // pageCursors[i] est le curseur "before" a utiliser pour recuperer la page i+1
      // (pagination par curseur cote serveur ; construit au fil de la navigation).
      pageCursors: [undefined],
      lastSeenWsInitCount: this.$store.state.wsInitCount,
    }
  },
  computed: {
    // Filtres client conserves tels quels : utilises uniquement en mode live,
    // sur la fenetre bornee `store.state.tours` (comportement inchange pour la
    // page 1 "Tous" sans recherche).
    toursAll() {
      if (this.$store.state.course.status === 'TEST') {
        return this.$store.state.tours.filter(t => t.status === 'ignore')
      } else {
        return this.$store.state.tours.filter(t => t.status !== 'ignore')
      }
    },
    toursNormaux() { return this.toursAll.filter(t => t.dossard && !t.status) },
    toursDuplicate() { return this.toursAll.filter(t => t.status === 'duplicate') },
    toursDeleted() { return this.toursAll.filter(t => t.status === 'deleted') },
    toursUnknown() {
        return this.toursAll.filter(t => !t.dossard)
    },
    toursSelected() {
      const words = this.search.toLowerCase().split(' ').filter(v => v)
      let tours =  this[this.selection]
      if (!words.length) return tours
      return tours.filter(tour => {
        const haystack = `${tour.transpondeur} ${tour.dossard}`.toLowerCase()
        return words.every(word => haystack.includes(word))
      })
    },
    isLiveMode() {
      return this.selection === 'toursAll' && this.search === '' && this.currentPage === 1
    },
    toursCounts() {
      return this.$store.state.toursCounts || { all: 0, normaux: 0, duplicate: 0, deleted: 0, unknown: 0 }
    },
    newToursSincePage1() {
      return this.$store.state.newToursSincePage1 || 0
    },
    displayedTours() {
      return this.isLiveMode ? this.toursSelected : this.frozenTours
    },
    tableCurrentPage() {
      return this.isLiveMode ? this.currentPage : 1
    },
    tablePerPage() {
      return this.isLiveMode ? this.perPage : 0
    },
    totalRows() {
      if (this.isLiveMode) return this.toursCounts.all
      if (!this.search) return this.toursCounts[SELECTION_TO_STATUS[this.selection]] || 0
      // Pas de total exact disponible sous recherche (pagination par curseur,
      // pas de COUNT server filtre) : total "juste assez grand" pour piloter
      // l'activation du bouton suivant/precedent de b-pagination.
      return (this.currentPage - 1) * this.perPage + this.frozenTours.length + (this.frozenHasMore ? this.perPage : 0)
    },
  },
  watch: {
    selection() { this.resetToPage1() },
    search() { this.resetToPage1() },
    currentPage(page) {
      if (!this.isLiveMode) this.loadFrozenPage(page)
    },
    isLiveMode: {
      immediate: true,
      handler(live) {
        this.$store.state.toursLiveMode = live
        if (live) this.$store.state.newToursSincePage1 = 0
      },
    },
    '$store.state.wsInitCount'(count) {
      if (count === this.lastSeenWsInitCount) return
      this.lastSeenWsInitCount = count
      this.selection = 'toursAll'
      this.search = ''
      this.currentPage = 1
    },
  },
  methods: {
    resetToPage1() {
      this.pageCursors = [undefined]
      if (this.currentPage !== 1) {
        this.currentPage = 1
        return
      }
      if (!this.isLiveMode) this.loadFrozenPage(1)
    },
    resetToLive() {
      this.selection = 'toursAll'
      this.search = ''
      this.currentPage = 1
    },
    async ensureCursor(page) {
      while (this.pageCursors.length < page) {
        const before = this.pageCursors[this.pageCursors.length - 1]
        if (before === null) return null
        const res = await this.fetchToursPage(before)
        const lastTour = res.tours[res.tours.length - 1]
        this.pageCursors.push(res.hasMore && lastTour ? `${lastTour.timestamp}:${lastTour.id}` : null)
      }
      return this.pageCursors[page - 1]
    },
    async fetchToursPage(before) {
      const params = new URLSearchParams({ status: SELECTION_TO_STATUS[this.selection], limit: this.perPage })
      if (before) params.set('before', before)
      if (this.search) params.set('search', this.search)
      const res = await fetch(`${this.$root.URL}/tours?${params.toString()}`)
      return res.json()
    },
    async loadFrozenPage(page) {
      const cursor = await this.ensureCursor(page)
      if (cursor === null && page > 1) {
        this.frozenTours = []
        this.frozenHasMore = false
        return
      }
      const res = await this.fetchToursPage(cursor)
      this.frozenTours = res.tours
      this.frozenHasMore = res.hasMore
    },
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>
