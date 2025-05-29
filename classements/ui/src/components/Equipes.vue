<template>
  <div class="equipes d-flex flex-column h-100" style="max-height: 100vh;">
    <div class="d-flex flex-column">
      <b-container fluid>
        <b-row>
          <b-col cols="8">
            <b-button-toolbar>
              <b-button-group size="sm">
                <b-button :variant="currentCategorie==null ? 'info' : ''" @click="currentCategorie = null">Général <b-badge pill variant="light">{{ Object.keys($store.state.equipes).length }}</b-badge></b-button>
                <b-button v-for="categorie in categories" :key="categorie" :variant="categorie===currentCategorie ? 'info' : ''" @click="currentCategorie = categorie">{{ categorie }} <b-badge pill variant="light">{{ Object.values($store.state.equipes).filter(e => e.categorie === categorie).length }}</b-badge></b-button>
              </b-button-group>
              <b-input-group size="sm">
                <b-form-input v-model="search" placeholder="Recherche"></b-form-input>
              </b-input-group>
            </b-button-toolbar>
          </b-col>
          <b-col cols="4">
            <b-pagination
              v-model="currentPage"
              :total-rows="equipes.length"
              :per-page="perPage"
              aria-controls="equipes-table"
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
      <b-table id="equipes-table" striped hover small sticky-header="100vh" :items="equipes" :fields="fields"
          primary-key="equipe" :tbody-transition-props="transProps" :perPage="perPage" :currentPage="currentPage">
        <template #cell(equipe)="data">
            <b-link @click="showEquipe(data.item.equipe)">{{ data.item.equipe }}</b-link>
        </template>
        <template #cell(nom)="data">
            <b-link @click="showEquipe(data.item.equipe)">{{ data.item.nom }}</b-link>
        </template>
        <template #cell(tours)="data">
          <transition name="highlight-change" mode="out-in">
            <div :key="data.item.tours">
                {{ data.item.tours + data.item.penalite }}
                <span class="text-danger" v-if="data.item.penalite">({{ data.item.penalite ? `${data.item.tours}${data.item.penalite}` : '' }} <BIconFlagFill></BIconFlagFill>)</span>
            </div>
          </transition>
        </template>
      </b-table>
    </div>
  </div>
</template>

<script>
import _ from 'lodash'
import { formatTime } from '../utils'
export default {
  name: 'Equipes',
  data() {
    return {
      currentCategorie: null,
      search: '',
      perPage: 100,
      currentPage: 1,
      transProps: {
        // Transition name
        name: 'flip-list'
      },
      fields: [
        {
          key: 'equipe',
          sortable: true
        },
        {
          key: 'nom',
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
          key: 'tours',
          sortable: true
        },
        {
          key: 'temps',
          sortable: true,
          formatter: formatTime
        },
      ],
    }
  },
  computed: {
    equipes() {
      const equipes = []
      const words = this.search.toLowerCase().split(' ').filter(v => v)
      for (const equipe of Object.values(this.$store.state.equipes)) {
        if (this.currentCategorie && equipe.categorie !== this.currentCategorie) continue
          if (words.length) {
            const equipiers = Object.values(this.$store.state.equipiers)
                  .filter(equipier => String(equipier.dossard).slice(0, -1) === String(equipe.equipe))
                  .map(equipier => `${equipier.dossard} ${equipier.nom} ${equipier.prenom}`);
            const haystack = `${equipe.equipe} ${equipe.nom} ${equipe.categorie} ${equipe.gerant_nom} ${equipe.gerant_prenom} ${equipiers.join(' ')}`.toLowerCase()
            if (!words.every(word => haystack.includes(word))) continue;
          }
        equipes.push(equipe)
      }
      return _.sortBy(equipes, 'position_general');
    },
    categories() {
      const categories = []
      for (const equipe of Object.values(this.$store.state.equipes)) {
        if (!categories.includes(equipe.categorie)) {
          categories.push(equipe.categorie)
        }
      }
      return categories
    }
  },
  methods: {
    showEquipe(numero) {
      this.$router.push(`/equipe/${numero}`)
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
table#equipes-table .flip-list-move {
  transition: transform .5s;
}
.highlight-change-enter-active {
  transition: all .3s ease;
}
.highlight-change-leave-active {
  transition: all .8s ease;
}
.highlight-change-enter-from, .highlight-change-leave-to {
  background-color: #ff000000;
}
@supports (position: sticky) {
  .b-table-sticky-header > :deep(.table.b-table > thead > tr > th) {
    position: sticky !important;
  }
}
</style>
