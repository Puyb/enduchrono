<template>
  <div class="tours">
    <b-container fluid>
      <b-row>
        <b-col cols="4">
          <b-table-simple small>
            <b-tr><b-th>Equipe</b-th><b-td>{{ numero }}</b-td></b-tr>
            <b-tr><b-th>Nom</b-th><b-td>{{ equipe.nom }}</b-td></b-tr>
            <b-tr><b-th>Categorie</b-th><b-td>{{ equipe.categorie }} <EquipeCategorie :equipe="equipe" /></b-td></b-tr>
            <b-tr><b-th>Classement général</b-th><b-td>{{ equipe.position_general }}</b-td></b-tr>
            <b-tr><b-th>Classement categorie</b-th><b-td>{{ equipe.position_categorie }}</b-td></b-tr>
            <b-tr><b-th>Tours</b-th><b-td>{{ equipe.tours + equipe.penalite }} <EquipePenalite :equipe="equipe"></EquipePenalite></b-td></b-tr>
            <b-tr><b-th>Dernier passage</b-th><b-td>{{ formatTime(equipe.temps) }}</b-td></b-tr>
          </b-table-simple>
        </b-col>
        <b-col cols="8">
          <b-table striped hover small :items="equipiers" :fields="equipiersFields" :tbody-tr-class="rowClass">
              <template #cell(tours)="data">
                  {{ data.item.tours }} <b-button variant="outline-secondary" size="sm"><BIconPlus></BIconPlus></b-button>
              </template>
              <template #cell(transpondeurs)="data">
                  <EquipierTranspondeurs :equipier="data.item" />
              </template>
          </b-table>
        </b-col>
      </b-row>
    </b-container>
    <b-tabs content-class="mt-3">
      <b-tab title="Tours" active>
        <ToursTable :tours="tours" :fields="toursFields" :tbody-tr-class="rowClass" />
      </b-tab>
      <b-tab title="Graph">
        <EquipierChart :equipiers="equipiers" :colors="equipierColors"></EquipierChart>
      </b-tab>
    </b-tabs>
  </div>
</template>

<script>
import EquipierChart from './EquipierChart.vue'
import EquipePenalite from './EquipePenalite.vue'
import EquipeCategorie from './EquipeCategorie.vue'
import EquipierTranspondeurs from './EquipierTranspondeurs.vue'
import ToursTable from './ToursTable.vue'
import { formatTime, formatDuree } from '../utils'
export default {
  name: 'Tours',
  components: { EquipierChart, EquipePenalite, EquipeCategorie, EquipierTranspondeurs, ToursTable },
  props: {
    numero: null,
  },
  data() {
    return {
      equipiersFields: [
        'dossard',
        'nom',
        'prenom',
        'sexe',
        'tours',
        'passage',
        'duree',
        'transpondeurs',
      ],
      toursFields: [
        {
          key: 'id',
          sortable: true
        },
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
          key: 'nom',
          sortable: true
        },
        {
          key: 'prenom',
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
          formatter: formatDuree
        },
      ],
      equipierColors: ['primary', 'danger', 'success', 'warning', 'info'],
    }
  },
  computed: {
    equipe() {
      return this.$store.state.equipes[this.numero]
    },
    equipiers() {
      return Object.values(this.$store.state.equipiers).filter(equipier => String(equipier.dossard).slice(0, -1) === this.numero).map(equipier => {
        const tours = this.$store.state.tours.filter(tour => tour.dossard === equipier.dossard && !tour.status);
          return {
            ...equipier,
            tours: tours.length,
            passage: formatTime(Math.max(...tours.map(tour => tour.timestamp))),
            duree: formatDuree(tours.reduce((a, tour) => a + tour.duree, 0) / tours.length),
        };
      });
    },
    tours() {
      const tours = this.$store.state.tours
        .filter(tour => String(tour.dossard).slice(0, -1) === this.numero)
      if (this.$store.state.course.status === 'TEST') {
        return tours.filter(t => t.status === 'ignore')
      } else {
        return tours.filter(t => t.status !== 'ignore')
      }
    },
  },
  methods: {
    rowClass(item, type) {
      if (!item || type !== 'row') return
      const classes = []
      if (item.status === 'deleted') classes.push('text-decoration-line-through-red')
      if (item.status === 'duplicate') classes.push('text-decoration-line-through-blue')
      classes.push(`table-${this.equipierColors[String(item.dossard).slice(-1)]}`)
      return classes
    },
    formatTime,
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>
