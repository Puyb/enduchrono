<template>
  <div class="equipes">
    <b-button-toolbar>
    <b-button-group>
      <b-button :variant="currentCategorie==null ? 'info' : ''" @click="filterCategorie()">Général</b-button>
      <b-button v-for="categorie in categories" :key="categorie" :variant="categorie===currentCategorie ? 'info' : ''" @click="filterCategorie(categorie)">{{ categorie }}</b-button>
    </b-button-group>
    </b-button-toolbar>
    <b-table id="equipes" striped hover small :items="equipes" :fields="fields"
             primary-key="equipe"
      :tbody-transition-props="transProps">
      <template #cell(tours)="data">
        <transition name="highlight-change" mode="out-in">
          <div :key="data.item.tours">{{ data.item.tours }}</div>
        </transition>
      </template>
    </b-table>
  </div>
</template>

<script>
import _ from 'lodash'
const format = v => Math.floor(v).toString().padStart(2, '0')
export default {
  name: 'Equipes',
  props: {
    currentCategorie: null,
  },
  data() {
    return {
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
          formatter(value) { return `${format(value / 3600000)}:${format(value / 60000 % 60)}:${format(value / 1000 % 60)}.${(value % 1000).toString().padStart(3, '0')}` },
        },
      ],
    }
  },
  computed: {
    equipes() {
      const equipes = []
      for (const equipe of Object.values(this.$store.state.equipes)) {
        if (!this.currentCategorie || equipe.categorie === this.currentCategorie) {
          equipes.push(equipe)
        }
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
    filterCategorie(categorie = null) {
      if (!categorie) {
        this.$router.push('/equipes')
        return
      }
      this.$router.push(`/equipes/${categorie}`)
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style>
table#equipes .flip-list-move {
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
</style>
