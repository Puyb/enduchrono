import Vue from 'vue'
import App from './App.vue'
import { BootstrapVue, BIcon, BIconPencil, BIconPlus, BIconPersonXFill, BIconFlagFill, BIconArrowRightShort, BIconTrash, BIconPower, BIconRecycle } from 'bootstrap-vue'
import VueRouter from 'vue-router'
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'
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
import store from './store'

const router = new VueRouter({
  routes: [
    { name: 'tours', path: '/tours', component: Tours },
    { name: 'transpondeurs', path: '/transpondeurs', component: Transpondeurs },
    { name: 'equipes', path: '/equipes', component: Equipes },
    { name: 'categories', path: '/equipes/:currentCategorie', component: Equipes, props: true },
    { name: 'equipe', path: '/equipe/:numero', component: Equipe, props: true }
  ],
})
new Vue({
  router,
  render: h => h(App),

  store,

  mounted(){
    this.URL = location.origin
    if (window.webpackHotUpdate) { // dev mode
      this.URL = this.URL.replace(':8080', ':3000')
    }
    const connect = () => {
      const connection = new WebSocket(`${this.URL.replace(/^http/, 'ws')}/websockets/control`)
      connection.onmessage = (message) => {
        const data = JSON.parse(message.data)
        console.log('data', data, data.equipe?.equipe)
        Object.assign(this, data)
        if (data.event === 'init') {
          this.$store.state.tours = data.tours
          this.$store.state.equipes = data.equipes
          this.$store.state.equipiers = data.equipiers
          this.$store.state.categories = data.categories
          this.$store.state.transpondeurs = data.transpondeurs
        }
        if (data.event === 'tour') this.$store.state.tours.push(data.tour)
        if (data.event === 'equipe') this.$store.state.equipes[data.equipe.equipe] = data.equipe
        if (data.event === 'update') {
          for (const event of data.events) {
            if (event.event === 'tour') {
              if (event.update) {
                Object.assign(this.$store.state.tours.find(t => t.id === event.tour.id), event.tour)
              } else {
                this.$store.state.tours.unshift(event.tour)
              }
            }
            if (event.event === 'equipe') this.$store.state.equipes[event.equipe.equipe] = event.equipe
            if (event.event === 'transpondeur') this.$store.state.transpondeurs.unshift(event.transpondeur)
          }
        }
      }
      connection.onclose = function(e) {
        console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason);
        setTimeout(function() {
          connect();
        }, 1000);
      };

      connection.onerror = function(err) {
        console.error('Socket encountered error: ', err.message, 'Closing socket');
        connection.close();
      };
    }
    connect()
  }
}).$mount('#app')
