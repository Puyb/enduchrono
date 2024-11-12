<template>
  <div class="d-flex flex-column h-100">
    <b-navbar toggleable="lg" type="dark" variant="info" class="sticky-top">
      <b-navbar-brand href="#">Chrono</b-navbar-brand>

      <b-navbar-toggle target="nav-collapse"></b-navbar-toggle>

      <b-collapse id="nav-collapse" is-nav>
        <b-navbar-nav>
          <b-nav-item :active="$route.name === 'tours'" to="/tours">Tours</b-nav-item>
          <b-nav-item :active="['equipe', 'equipes', 'categories'].includes($route.name)" to="/equipes">Équipes / Classements</b-nav-item>
          <b-nav-item :active="$route.name === 'transpondeurs'" to="/transpondeurs">Transpondeurs</b-nav-item>
        </b-navbar-nav>
        <b-navbar-nav class="ml-auto">
          <b-nav-text>{{ $store.state.tours.length }} tour{{ $store.state.tours.length > 1 ? 's' : '' }} - {{ time }} </b-nav-text>
          <b-button>Stop</b-button>
        </b-navbar-nav>
      </b-collapse>
    </b-navbar>
    <div class="d-flex flex-column flex-grow">
      <router-view></router-view>
    </div>
  </div>
</template>

<script>
import { formatTime } from './utils'
export default {
  name: 'App',
  data() {
    return {
      time: formatTime(12345678),
    }
  } 
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
</style>
