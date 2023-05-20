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
            <b-tr><b-th>Dernier passage</b-th><b-td>{{ equipe.temps }}</b-td></b-tr>
          </b-table-simple>
        </b-col>
        <b-col cols="8">
          <b-table striped hover small :items="equipiers" :fields="equipiersFields">
          </b-table>
          <EquipierChart :equipiers="equipiers"></EquipierChart>
        </b-col>
      </b-row>
    </b-container>
    <b-table striped hover small :items="tours" :fields="toursFields">
      <template #cell(index)="data">
        {{ data.index + 1 }}
      </template>

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

      <!-- Optional default data cell scoped slot -->
      <template #cell()="data">
        {{ data.value }}
      </template>
    </b-table>
  </div>
</template>

<script>
import EquipierChart from './EquipierChart.vue'
const format = v => Math.floor(v).toString().padStart(2, '0')
export default {
  name: 'Tours',
  components: { EquipierChart },
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
        'index',
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
          formatter(value) { return `${format(value / 3600000)}:${format(value / 60000 % 60)}:${format(value / 1000 % 60)}.${(value % 1000).toString().padStart(3, '0')}` },
        },
        {
          key: 'duree',
          sortable: true,
          formatter(value) { return `${format(value / 3600000)}:${format(value / 60000 % 60)}:${format(value / 1000 % 60)}.${(value % 1000).toString().padStart(3, '0')}` },
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
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>
