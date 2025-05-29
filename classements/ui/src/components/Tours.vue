<template>
  <div class="d-flex flex-column h-100" style="max-height: 100vh;">
    <div class="d-flex flex-column">
      <b-container fluid>
        <b-row>
          <b-col cols="8">
            <b-button-toolbar>
              <b-button-group size="sm">
                <b-button :variant="selection=='toursAll' ? 'info' : ''" @click="selection = 'toursAll'">Tous <b-badge pill variant="light">{{ toursAll.length }}</b-badge></b-button>
                <b-button :variant="selection=='toursNormaux' ? 'info' : ''" @click="selection = 'toursNormaux'">Normaux <b-badge pill variant="light">{{ toursNormaux.length }}</b-badge></b-button>
                <b-button :variant="selection=='toursDuplicate' ? 'info' : ''" @click="selection = 'toursDuplicate'">Dupliqués <b-badge pill variant="light">{{ toursDuplicate.length }}</b-badge></b-button>
                <b-button :variant="selection=='toursDeleted' ? 'info' : ''" @click="selection = 'toursDeleted'">Supprimés <b-badge pill variant="light">{{ toursDeleted.length }}</b-badge></b-button>
                <b-button :variant="selection=='toursUnknown' ? 'info' : ''" @click="selection = 'toursUnknown'">Inconnus <b-badge pill variant="light">{{ toursUnknown.length }}</b-badge></b-button>
              </b-button-group>
              <b-input-group size="sm">
                <b-form-input v-model="search" placeholder="Recherche"></b-form-input>
              </b-input-group>
            </b-button-toolbar>
          </b-col>
          <b-col cols="4">
            <b-pagination
              v-model="currentPage"
              :total-rows="$store.state.tours.length"
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
      <ToursTable :tours="toursSelected" :fields="fields" :perPage="perPage" :currentPage="currentPage"/>
    </div>
  </div>
</template>

<script>
import ToursTable from './ToursTable.vue'
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
    }
  },
  computed: {
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
        const haystack = `${tours.transpondeur} ${tour.dossard}`.toLowerCase()
        return words.every(word => haystack.includes(word))
      })
    } 
  },
  methods: {
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>
