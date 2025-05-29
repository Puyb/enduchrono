import Vue from 'vue'
import App from './App.vue'
import { BootstrapVue, BIcon, BIconPencil, BIconPlus, BIconPersonXFill, BIconFlagFill, BIconArrowRightShort, BIconTrash, BIconPower, BIconRecycle } from 'bootstrap-vue'
import VueRouter from 'vue-router'
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'
import { last }  from 'lodash'
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
new Vue({
  router,
  render: h => h(App),

  store,

  mounted(){
    console.log('mounted', new Date())
    this.URL = location.origin
    if (window.webpackHotUpdate) { // dev mode
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
        }
        if (data.event === 'tour') this.$store.state.tours.push(data.tour)
        if (data.event === 'equipe') this.$store.state.equipes[data.equipe.equipe] = data.equipe
        if (data.event === 'update') {
          for (const event of data.events) {
            if (event.event === 'tour') {
              if (event.update) {
                Object.assign(this.$store.state.tours.find(t => t.id === event.tour.id), event.tour)
              } else {
                const tours = this.$store.state.tours
                if (tours[0]?.timestamp > event.tour.timestamp) {
                  const pos = tours.findIndex(t => t.timestamp < event.tour.timestamp)
                  tours.splice(pos + 1, 0, event.tour)
                } else {
                  tours.unshift(event.tour)
                }
              }
            }
            if (event.event === 'equipe') this.$store.state.equipes[event.equipe.equipe] = event.equipe
            if (event.event === 'equipier') this.$store.state.equipiers[event.equipier.dossard] = event.equipier
            if (event.event === 'transpondeur') this.$store.state.transpondeurs.unshift(event.transpondeur)
          }
        }
        if (data.event === 'course') {
          this.$store.commit('setStatus', data.course.status)
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
