<template>
  <div>
    <div class="d-flex flex-column" style="height: 100vh; max-height: 100vh;" v-if="!!$store.state.course">
      <b-navbar toggleable="lg" type="dark" variant="info" class="sticky-top mb-1">
        <b-navbar-brand href="#">{{ $store.state.course.name }}</b-navbar-brand>

        <b-navbar-toggle target="nav-collapse"></b-navbar-toggle>

        <b-collapse id="nav-collapse" is-nav>
          <b-navbar-nav>
            <b-nav-item :active="$route.name === 'tours'" to="/tours">Tours <b-badge pill variant="light">{{ toursAll.length }}</b-badge></b-nav-item>
            <b-nav-item :active="['equipe', 'equipes', 'categories'].includes($route.name)" to="/equipes">Équipes / Classements <b-badge pill variant="light">{{ Object.keys($store.state.equipes).length }}</b-badge></b-nav-item>
            <b-nav-item :active="$route.name === 'transpondeurs'" to="/transpondeurs">Transpondeurs <b-badge pill variant="light">{{ transpondeursAll.length }}</b-badge></b-nav-item>
            <b-nav-item :active="$route.name === 'stats'" to="/stats">Stats</b-nav-item>
          </b-navbar-nav>
          <b-navbar-nav class="ml-auto" id="status">
            <b-nav-text v-if="$store.state.course.status === 'TEST'">Test avant course</b-nav-text>
            <b-nav-text v-if="$store.state.course.status === 'DEPART'">Attente départ</b-nav-text>
            <b-nav-text v-if="$store.state.course.status === 'COURSE'">{{ $store.state.tours.length }} tour{{ $store.state.tours.length > 1 ? 's' : '' }} - {{ formatTime($store.state.time) }} </b-nav-text>
            <b-nav-text v-if="$store.state.course.status === 'FIN'">Course terminée</b-nav-text>
            <b-button v-if="$store.state.course.status === 'TEST'" @click="stopTest()">Stop</b-button>
            <b-button v-if="$store.state.course.status === 'COURSE'" @click="stopCourse()">Stop</b-button>
            <b-button v-if="$store.state.course.status === 'FIN'" @click="closeCourse()">Fermer</b-button>
          </b-navbar-nav>
        </b-collapse>
      </b-navbar>
      <div class="d-flex flex-column flex-fill" style="overflow: scroll">
        <router-view></router-view>
      </div>
    </div>
    <div v-if="!$store.state.course">
      <h1>Nouvelle course</h1>
      <form method="post" enctype="multipart/form-data" :action="$store.state.URL + '/import'">
        <div class="mb-3">
          <label for="name" class="form-label">Nom</label>
          <input type="text" class="form-control" id="name" name="name">
        </div>
        <div class="mb-3">
          <label for="equipes" class="form-label">Fichier CSV équipes</label>
          <input type="file" class="form-control" id="equipes" name="equipes">
        </div>
        <div class="mb-3">
          <label for="equipiers" class="form-label">Fichier CSV équipiers</label>
          <input type="file" class="form-control" id="equipiers" name="equipiers">
        </div>
        <div class="mb-3">
          <label for="transpondeurs" class="form-label">Fichier CSV transpondeurs</label>
          <input type="file" class="form-control" id="transpondeurs" name="transpondeurs">
        </div>
        <button type="submit" class="btn btn-primary">Submit</button>
      </form>
      <h1>Ouvrir une course</h1>
      <b-button @click="openCourse(filename)" v-for="filename of $store.state.filenames" :key="filename">{{filename}}</b-button>
    </div>
    <b-modal v-model="showError" hide-footer hide-header no-close-on-backdrop>
      Error {{ $store.state.error }}
      <b-row>
        <b-col class="col-3">
          <b-iconstack font-scale=6>
            <b-icon-cpu stacked />
            <b-icon-emoji-frown-fill v-if="$store.state.error === 'chronelec'" variant="danger" shift-h="6" shift-v="-6" stacked scale="0.3" />
          </b-iconstack>
          <h5>Chronelec hardware</h5>
        </b-col>
        <b-col class="col-3">
          <b-iconstack font-scale=6>
            <b-icon-stopwatch stacked />
            <b-icon-emoji-frown-fill v-if="$store.state.error === 'chrono'" variant="danger" shift-h="6" shift-v="-6" stacked scale="0.3" />
          </b-iconstack>
          <h5>Chrono service</h5>
        </b-col>
        <b-col class="col-3">
          <b-iconstack font-scale=6>
            <b-icon-trophy stacked />
            <b-icon-emoji-frown-fill v-if="$store.state.error === 'classement'" variant="danger" shift-h="6" shift-v="-6" stacked scale="0.3" />
          </b-iconstack>
          <h5>Classement service</h5>
        </b-col>
        <b-col class="col-3">
          <b-icon-laptop font-scale=6 />
          <h5>Web interface</h5>
        </b-col>
      </b-row>
        <b-col class="col-12">
          <pre>{{ $store.state.errorMessage }}</pre>
        </b-col>
      <b-row>
      </b-row>
    </b-modal>
    <b-modal v-model="showDepart" title="Départ" @ok="startCourse" @cancel="startTest" ok-title="Départ" cancel-title="Mode test" no-close-on-backdrop>
      <template #default="{}">
        Démarrer la course ?
      </template>
      <template #modal-footer="{}">
        <b-button size="sm" variant="secondary" @click="startTest()">
          Mode test
        </b-button>
        <b-button size="sm" variant="success" @click="startCourse()">
          Départ
        </b-button>
        <b-button size="sm" variant="danger" @click="closeCourse()">
          Fermer la course
        </b-button>
      </template>
    </b-modal>
  </div>
</template>

<script>
import { formatTime } from './utils'
import { BIconstack, BIconStopwatch, BIconCpu, BIconTrophy, BIconLaptop, BIconEmojiFrownFill } from 'bootstrap-vue'
export default {
  name: 'App',
  components: { BIconstack, BIconStopwatch, BIconCpu, BIconTrophy, BIconLaptop, BIconEmojiFrownFill }, 
  computed: {
    showError() { return !!this.$store.state.error },
    showDepart() { return this.$store.state.course?.status === 'DEPART' },
    toursAll() {
      if (this.$store.state.course.status === 'TEST') {
        return this.$store.state.tours.filter(t => t.status === 'ignore')
      } else {
        return this.$store.state.tours.filter(t => t.status !== 'ignore')
      }
    },
    transpondeursAll() { return this.$store.state.transpondeurs },
  },
  methods: {
    async stopTest() {
      await fetch(`${this.$store.state.URL}/test/stop`, { method: 'POST' })
    },
    async startTest() {
      await fetch(`${this.$store.state.URL}/test/start`, { method: 'POST' })
    },
    async startCourse() {
      await fetch(`${this.$store.state.URL}/course/start`, { method: 'POST' })
    },
    async stopCourse() {
      const fin = await this.$bvModal.msgBoxConfirm("Terminer la course (ceci n'est pas annulable) ?")
      if (fin) {
        await fetch(`${this.$store.state.URL}/course/stop`, { method: 'POST' })
      }
    },
    async closeCourse() {
      await fetch(`${this.$store.state.URL}/course/close`, { method: 'POST' })
    },
    async openCourse(filename) {
      await fetch(`${this.$store.state.URL}/course/open`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename }) })
    },
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
