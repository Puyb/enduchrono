import Vue from 'vue'
import App from './App.vue'
import BootstrapVue from 'bootstrap-vue'
import VueRouter from 'vue-router'
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'
Vue.use(BootstrapVue)
Vue.use(VueRouter)

Vue.config.productionTip = false

import Tours from './components/Tours.vue'
import Equipes from './components/Equipes.vue'
import Equipe from './components/Equipe.vue'
import store from './store'

const router = new VueRouter({
  routes: [
    { path: '/tours', component: Tours },
    { path: '/classements', component: Equipes },
    { path: '/classements/:currentCategorie', component: Equipes, props: true },
    { path: '/equipes', component: Equipes },
    { path: '/equipes/:numero', component: Equipe, props: true }
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
    const connection = new WebSocket(`${this.URL.replace(/^http/, 'ws')}/websockets/control`)
    connection.onmessage = (message) => {
      const data = JSON.parse(message.data)
      console.log('data', data)
      Object.assign(this, data)
      if (data.event === 'init') {
        this.$store.state.tours = data.tours
        this.$store.state.equipes = data.equipes
        this.$store.state.equipiers = data.equipiers
      }
      if (data.event === 'tour') this.$store.state.tours.push(data.tour)
      if (data.event === 'equipe') this.$store.state.equipes[data.equipe.equipe] = data.equipe
    }
  }
}).$mount('#app')
