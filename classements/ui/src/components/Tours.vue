<template>
  <div class="tours">
    <b-table striped hover small :items="$store.state.tours" :fields="fields">
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
const format = v => Math.floor(v).toString().padStart(2, '0')
export default {
  name: 'Tours',
  props: {
    tours: [],
  },
  data() {
    return {
      fields: [
        'index',
        {
          key: 'dossard',
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
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>
