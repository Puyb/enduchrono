<template>
  <b-table id="tours-table" striped sticky-header="100vh" hover small :items="tours" :fields="fields" :tbody-tr-class="rowClass" :perPage="perPage" :currentPage="currentPage">
    <template #cell(id)="data">
      {{ data.item.id }}
      <b-button v-if="!data.item.status" variant="danger" @click="deleteTour(data.item)" size="sm" class="tour-delete"><b-icon-trash /></b-button>
      <b-button v-if="['deleted', 'duplicate'].includes(data.item.status)" variant="danger" @click="deleteTour(data.item)" size="sm" class="tour-delete"><b-icon-recycle /></b-button>
    </template>
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
    <template #cell(position_general)="data">
      {{ $store.state.equipes[String(data.item.dossard).slice(0, -1)]?.position_general }}
    </template>
    <template #cell(position_categorie)="data">
      {{ $store.state.equipes[String(data.item.dossard).slice(0, -1)]?.position_categorie }}
    </template>
    <template #cell(numero)="data">
      {{ data.item.numero }}
    </template>
    <template #cell(numeroParEquipe)="data">
      {{ numero(data.item) }}
    </template>
  </b-table>
</template>

<script>
import { groupBy, mapValues } from 'lodash'
export default {
  name: 'ToursTable',
  props: {
    tours: [],
    fields: {},
    perPage: null,
    currentPage: null,
    'tbody-tr-class': { type: Function }
  },
  data() {
    return {
    }
  },
  computed: {
  },
  methods: {
    rowClass(item, type) {
      if (!item || type !== 'row') return
      const classes = []
      if (this.tbodyTrClass) classes.push(this.tbodyTrClass(item, type))
      if (item.status === 'deleted') classes.push('text-decoration-line-through-red')
      if (item.status === 'duplicate') classes.push('text-decoration-line-through-blue')
      return classes
    },
    showEquipe(dossard) {
      this.$router.push(`/equipe/${String(dossard).slice(0, -1)}`)
    },
    async deleteTour(tour) {
      const equipe = this.$store.state.equipes[String(tour.dossard).slice(0, -1)]
      const message = `Voulez vous vraiment supprimer le tour ${tour.id} de l'équipe ${equipe?.nom} ?`
      if (await this.$bvModal.msgBoxConfirm(message, {
        title: 'Suppression de tour',
        okVariant: 'danger',
        okTitle: 'Supprimer',
        cancelTitle: 'Annuler',
      })) {
        await fetch(`${this.$root.URL}/tour/${tour.id}`, {
          method: 'delete',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      }
    },
    numero(tour) {
      if (!this._toursParEquipes || !Object.keys(this._toursParEquipes).length) {
        this._toursParEquipes = mapValues(groupBy(this.$store.state.tours.filter(t => t.dossard && !t.status), t => String(t.dossard).slice(0, -1)), v => v.reverse())
        setTimeout(() => delete this._toursParEquipes, 100);
      }
      return (this._toursParEquipes[String(tour.dossard).slice(0, -1)]?.indexOf(tour) + 1) || null
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
#tours-table tr button { display: none; }
#tours-table tr:hover button { display: inline; }
:deep(tr.text-decoration-line-through-red) {
  text-decoration: line-through red 0.2em wavy;
}
:deep(tr.text-decoration-line-through-blue) {
  text-decoration: line-through blue 0.2em wavy;
}
@supports (position: sticky) {
  .b-table-sticky-header > :deep(.table.b-table > thead > tr > th) {
    position: sticky !important;
  }
}
</style>

