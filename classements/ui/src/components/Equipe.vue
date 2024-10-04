<template>
  <div class="tours">
    <b-container fluid>
      <b-row>
        <b-col cols="4">
          <b-table-simple>
            <b-tr><b-th>Equipe</b-th><b-td>{{ numero }}</b-td></b-tr>
            <b-tr><b-th>Nom</b-th><b-td>{{ equipe.nom }}</b-td></b-tr>
            <b-tr><b-th>Categorie</b-th><b-td>{{ equipe.categorie }}</b-td></b-tr>
            <b-tr><b-th>Classement général</b-th><b-td>{{ equipe.position_general }}</b-td></b-tr>
            <b-tr><b-th>Classement categorie</b-th><b-td>{{ equipe.position_categorie }}</b-td></b-tr>
            <b-tr><b-th>Tours</b-th><b-td>{{ equipe.tours }}</b-td></b-tr>
            <b-tr><b-th>Dernier passage</b-th><b-td>{{ formatTime(equipe.temps) }}</b-td></b-tr>
          </b-table-simple>
          <b-button-toolbar>
            <b-button-group class="mx-1">
              <ChangeCategorie :equipe="equipe"></ChangeCategorie>
            </b-button-group>
            <b-button-group class="mx-1">
              <b-button @click="ajouterTour()">Ajouter tour</b-button>
            </b-button-group>
            <b-button-group class="mx-1">
              <b-button @click="ajouterPenalite()">Ajouter pénalité</b-button>
            </b-button-group>
            <b-button-group class="mx-1">
              <b-button @click="ajouterTranspondeur()">Ajouter transpondeur</b-button>
            </b-button-group>
            <b-button-group class="mx-1">
              <b-button @click="ajouterEquipier()">Ajouter équipier</b-button>
            </b-button-group>
            <b-button-group class="mx-1">
              <b-button @click="deplacerEquipier()">Déplacer équipier</b-button>
            </b-button-group>
            <b-button-group class="mx-1">
              <b-button @click="desactiverEquipier()">Désactiver équipier</b-button>
            </b-button-group>
          </b-button-toolbar>
        </b-col>
        <b-col cols="8">
          <b-table striped hover small :items="equipiers" :fields="equipiersFields">
          </b-table>
          <EquipierChart :equipiers="equipiers"></EquipierChart>
        </b-col>
      </b-row>
    </b-container>
    <b-table striped hover small :items="tours" :fields="toursFields" :tbody-tr-class="rowClass">
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
import EquipierChart from './EquipierChart.vue'
import ChangeCategorie from './ChangeCategorie.vue'
import { formatTime } from '../utils'
export default {
  name: 'Tours',
  components: { EquipierChart, ChangeCategorie },
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
        { key: 'transpondeurs', formatter(value) { return value && value.map(v => v.id).join(', ') } },
      ],
      toursFields: [
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
          formatter: formatTime
        },
      ],
    }
  },
  computed: {
    equipe() {
      return this.$store.state.equipes[this.numero]
    },
    equipiers() {
      return Object.values(this.$store.state.equipiers).filter(equipier => String(equipier.dossard).slice(0, -1) === this.numero)
    },
    tours() {
      return this.$store.state.tours.filter(tour => String(tour.dossard).slice(0, -1) === this.numero)
    },
  },
  methods: {
    rowClass(item, type) {
      if (!item || type !== 'row') return
      if (!item.dossard) return 'table-danger'
      if (item.duplicate) return 'table-warning'
    },
    formatTime,
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>
