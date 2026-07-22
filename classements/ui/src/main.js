import Vue from 'vue'
import App from './App.vue'
import { BootstrapVue, BIcon, BIconPencil, BIconPlus, BIconPersonXFill, BIconFlagFill, BIconArrowRightShort, BIconTrash, BIconPower, BIconRecycle } from 'bootstrap-vue'
import VueRouter from 'vue-router'
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'
import { last }  from 'lodash'
import { bus } from './eventBus'
import { insertTourDescending } from './utils'
Vue.use(BootstrapVue)
Vue.component('BIcon', BIcon)
Vue.component('BIconPencil', BIconPencil)
Vue.component('BIconPlus', BIconPlus)
Vue.component('BIconPersonXFill', BIconPersonXFill)
Vue.component('BIconFlagFill', BIconFlagFill)
Vue.component('BIconArrowRightShort', BIconArrowRightShort)
Vue.component('BIconTrash', BIconTrash)
Vue.component('BIconPower', BIconPower)
Vue.component('BIconRecycle', BIconRecycle)
Vue.use(VueRouter)

Vue.config.productionTip = false

import Tours from './components/Tours.vue'
import Transpondeurs from './components/Transpondeurs.vue'
import Equipes from './components/Equipes.vue'
import Equipe from './components/Equipe.vue'
import Stats from './components/Stats.vue'
import store from './store'

const router = new VueRouter({
  routes: [
    { path: '/', redirect: '/tours' },
    { name: 'tours', path: '/tours', component: Tours },
    { name: 'transpondeurs', path: '/transpondeurs', component: Transpondeurs },
    { name: 'equipes', path: '/equipes', component: Equipes },
    { name: 'categories', path: '/equipes/:currentCategorie', component: Equipes, props: true },
    { name: 'equipe', path: '/equipe/:numero', component: Equipe, props: true },
    { name: 'stats', path: '/stats', component: Stats },
  ],
})

const MAX_LIVE_TOURS = 100

// Buckets bruts par statut (miroir de `toursCounts` cote backend, classes.js),
// maintenus independamment du statut course courant : necessaires pour recalculer
// les compteurs exposes sans re-scanner tout l'historique lors d'un changement
// TEST <-> COURSE.
const emptyBucket = () => ({ total: 0, unknown: 0 })
const makeRawCounts = () => ({ ignore: emptyBucket(), null: emptyBucket(), duplicate: emptyBucket(), deleted: emptyBucket() })

// Reconstruit les buckets bruts a partir des compteurs exposes recus (init ou
// resynchronisation REST). Reconstruction exacte pour les totaux ; seule la
// repartition fine de `unknown` entre statuts est approximee (cas marginal :
// suppression d'un tour "inconnu", dossard non resolu).
const rawCountsFromExposed = (exposed, isTest) => {
  const raw = makeRawCounts()
  if (isTest) {
    raw.ignore = { total: exposed.all, unknown: exposed.unknown }
  } else {
    raw.duplicate = { total: exposed.duplicate, unknown: 0 }
    raw.deleted = { total: exposed.deleted, unknown: 0 }
    raw.null = { total: exposed.all - exposed.duplicate - exposed.deleted, unknown: exposed.unknown }
  }
  return raw
}

const computeExposedCounts = (raw, isTest) => {
  if (isTest) {
    return { all: raw.ignore.total, normaux: 0, duplicate: 0, deleted: 0, unknown: raw.ignore.unknown }
  }
  return {
    all: raw.null.total + raw.duplicate.total + raw.deleted.total,
    normaux: raw.null.total - raw.null.unknown,
    duplicate: raw.duplicate.total,
    deleted: raw.deleted.total,
    unknown: raw.null.unknown + raw.duplicate.unknown + raw.deleted.unknown,
  }
}

const adjustRawCounts = (raw, status, tour, delta) => {
  const bucket = raw[status === null ? 'null' : status]
  if (!bucket) return
  bucket.total += delta
  if (!tour.dossard) bucket.unknown += delta
}

const minuteBucket = timestamp => Math.floor(timestamp / 60000) * 60000

new Vue({
  router,
  render: h => h(App),

  store,

  mounted(){
    console.log('mounted', new Date())
    const configuredApiUrl = process.env.VUE_APP_API_BASE_URL
    this.URL = configuredApiUrl || location.origin
    if (!configuredApiUrl && window.webpackHotUpdate) { // dev mode
      this.URL = this.URL.replace(':8080', ':3000')
    }
    this.$store.state.URL = this.URL
    this.$store.state.course = {}

    let startDate = Date.now()
    this.$store.state.time = 0
    this.$store.state.error = null
    setInterval(() => {
      const lastTour = last(this.$store.state.tours)
      if (lastTour?.timestamp > this.$store.state.time) {
        startDate = Date.now() - lastTour.timestamp
      }
      // FIXME sync time with status event
      this.$store.state.time = Date.now() - startDate;
    }, 100)

    // Buckets bruts des compteurs de tours (voir helpers ci-dessus), pas expose
    // directement dans le store : seul `toursCounts` (forme deja agregee) l'est.
    let rawCounts = makeRawCounts()

    const isTest = () => this.$store.state.course.status === 'TEST'

    const recomputeExposedCounts = () => {
      this.$store.state.toursCounts = computeExposedCounts(rawCounts, isTest())
    }

    // Filet de securite quand un tour modifie n'est plus dans la fenetre live
    // bornee : on ne peut pas retrouver son ancien statut localement, on
    // resynchronise donc les compteurs exacts via l'API plutot que de laisser
    // les badges derailler.
    const resyncCounts = async () => {
      try {
        const res = await fetch(`${this.URL}/tours/count`)
        const exposed = await res.json()
        rawCounts = rawCountsFromExposed(exposed, isTest())
        this.$store.state.toursCounts = exposed
      } catch (err) {
        console.error('error resyncing tours count', err)
      }
    }

    const applyPerMinuteDelta = (timestamp, delta) => {
      const bucket = minuteBucket(timestamp)
      const count = (this.$store.state.toursPerMinute[bucket] || 0) + delta
      const toursPerMinute = { ...this.$store.state.toursPerMinute }
      if (count > 0) {
        toursPerMinute[bucket] = count
      } else {
        delete toursPerMinute[bucket]
      }
      this.$store.state.toursPerMinute = toursPerMinute
    }

    const onNewTour = tour => {
      insertTourDescending(this.$store.state.tours, tour)
      if (this.$store.state.tours.length > MAX_LIVE_TOURS) this.$store.state.tours.pop()
      adjustRawCounts(rawCounts, tour.status, tour, 1)
      recomputeExposedCounts()
      if (tour.status === null) applyPerMinuteDelta(tour.timestamp, 1)
      if (!this.$store.state.toursLiveMode) this.$store.state.newToursSincePage1++
    }

    const onUpdateTour = tour => {
      const existing = this.$store.state.tours.find(t => t.id === tour.id)
      const oldStatus = existing ? existing.status : undefined
      if (existing) Object.assign(existing, tour)
      if (oldStatus === undefined) {
        resyncCounts()
        return
      }
      if (oldStatus === tour.status) return
      adjustRawCounts(rawCounts, oldStatus, tour, -1)
      adjustRawCounts(rawCounts, tour.status, tour, 1)
      recomputeExposedCounts()
      if (oldStatus === null && tour.status !== null) applyPerMinuteDelta(tour.timestamp, -1)
      if (oldStatus !== null && tour.status === null) applyPerMinuteDelta(tour.timestamp, 1)
    }

    const connect = () => {
      console.log('connect', new Date())
      const connection = new WebSocket(`${this.URL.replace(/^http/, 'ws')}/websockets/control`)
      connection.addEventListener('message', (message) => {
        const data = JSON.parse(message.data)
        if (data.event !== 'status') console.log('data', data)
        if (data.event === 'init') {
          this.$store.state.course = data.course
          this.$store.state.tours = data.tours.reverse()
          this.$store.state.equipes = data.equipes
          this.$store.state.equipiers = data.equipiers
          this.$store.state.categories = data.categories
          this.$store.state.transpondeurs = data.transpondeurs
          this.$store.state.filenames = data.filenames
          this.$store.state.toursCounts = data.toursCounts
          this.$store.state.toursPerMinute = data.toursPerMinute
          rawCounts = rawCountsFromExposed(data.toursCounts, isTest())
          this.$store.state.toursLiveMode = true
          this.$store.state.newToursSincePage1 = 0
          this.$store.state.wsInitCount++
        }
        if (data.event === 'tour') {
          onNewTour(data.tour)
          bus.$emit('tour', data.tour, false)
        }
        if (data.event === 'equipe') this.$store.state.equipes[data.equipe.equipe] = data.equipe
        if (data.event === 'update') {
          for (const event of data.events) {
            if (event.event === 'tour') {
              if (event.update) {
                onUpdateTour(event.tour)
              } else {
                onNewTour(event.tour)
              }
              bus.$emit('tour', event.tour, !!event.update)
            }
            if (event.event === 'equipe') this.$store.state.equipes[event.equipe.equipe] = event.equipe
            if (event.event === 'equipier') this.$store.state.equipiers[event.equipier.dossard] = event.equipier
            if (event.event === 'transpondeur') this.$store.state.transpondeurs.unshift(event.transpondeur)
          }
        }
        if (data.event === 'course') {
          this.$store.commit('setStatus', data.course.status)
          recomputeExposedCounts()
        }
        if (data.event === 'connection') {
          if (data.connection.connected) this.$store.state.error = null
          if (!data.connection.connected) this.$store.state.error = 'chrono'
          this.$store.state.errorMessage = data.connection.error
        }
        if (data.event === 'status') {
          if (data.status.chrono_connected === false) this.$store.state.error = 'chronelec'
          if (data.status.chrono_connected === true) this.$store.state.error = null
          if (data.status.pending) this.$store.state.pending = data.status.pending
          if (data.status.timestamp) startDate = Date.now() - data.status.timestamp
          if (data.status.noise) {
            this.$store.state.noise.push(data.status.noise)
            if(this.$store.state.noise.length > 60 * 5)
              this.$store.state.noise.shift()
          }
        }
      })
      connection.addEventListener('close', (e) => {
        console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason)
        this.$store.state.error = 'classement'
        setTimeout(function() {
          connect();
        }, 1000)
      })
      connection.addEventListener('error', (err) => {
        console.error('Socket encountered error: ', err.message, 'Closing socket')
        connection.close();
      })
      connection.addEventListener('open', () => {
        console.log('connected', new Date())
        this.$store.state.error = ''
      })
    }
    connect()
  }
}).$mount('#app')
