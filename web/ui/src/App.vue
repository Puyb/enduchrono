<template>
  <div>
    <div class="d-flex flex-column" style="height: 100vh; max-height: 100vh;" v-if="!!$store.state.course">
      <b-navbar toggleable="lg" type="dark" variant="info" class="sticky-top mb-1">
        <b-navbar-brand href="#">{{ $store.state.course.name }}</b-navbar-brand>

        <b-navbar-toggle target="nav-collapse"></b-navbar-toggle>

        <b-collapse id="nav-collapse" is-nav>
          <b-navbar-nav>
            <b-nav-item to="" :active="currentCategorie == null">Général</b-nav-item>
            <b-nav-item v-for="categorie in categories" :key="categorie" :to="categorie" :active="currentCategorie === categorie">{{ categorie }}</b-nav-item>
          </b-navbar-nav>
        </b-collapse>
      </b-navbar>
      <div class="d-flex flex-column flex-fill" style="overflow: scroll">
        <Equipes></Equipes>
      </div>
    </div>
  </div>
</template>

<script>
import { formatTime } from './utils'
import Equipes from './components/Equipes.vue'
export default {
  name: 'App',
  components: { Equipes },
  computed: {
    categories() {
      const categories = []
      for (const equipe of Object.values(this.$store.state.equipes)) {
        if (!categories.includes(equipe.categorie)) {
          categories.push(equipe.categorie)
        }
      }
      return categories
    },
    currentCategorie() {
      return this.$route.path.split('/')[1] || null
    },
  },
  methods: {
    formatTime(t) { return formatTime(t) },
  },
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
#status .navbar-text {
  font-weight: bold;
  font-size: 2em;
  color: #fff;
  margin: -0.5em 10px;
}
</style>
