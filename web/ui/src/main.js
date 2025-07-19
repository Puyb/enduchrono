import Vue from 'vue'
import App from './App.vue'
import { BootstrapVue } from 'bootstrap-vue'
import VueRouter from 'vue-router'
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'
import { last }  from 'lodash'
import store from './store'
Vue.use(BootstrapVue)
Vue.use(VueRouter)

Vue.config.productionTip = false

new Vue({
  router: new VueRouter({}),

  render: h => h(App),

  store,

  mounted(){
    console.log('mounted', new Date())
    this.URL = location.origin
    if (window.webpackHotUpdate) { // dev mode
      this.URL = this.URL.replace(':8082', ':3003')
    }
    this.$store.state.URL = this.URL
    this.$store.state.course = {}
    
    const connect = () => {
      console.log('connect', new Date())
      const connection = new WebSocket(`${this.URL.replace(/^http/, 'ws')}/data`)
      connection.addEventListener('message', (message) => {
        const data = JSON.parse(message.data)
        if (data.event !== 'status') console.log('data', data)
        if (data.event === 'init') {
          this.$store.state.course = data.course
          this.$store.state.equipes = data.equipes
        }
        if (data.event === 'equipe') this.$store.state.equipes[data.equipe.equipe] = data.equipe
        if (data.event === 'course') this.$store.state.course = data.course
      })
      connection.addEventListener('close', (e) => {
        console.log('Socket is closed. Reconnect will be attempted in 1 second.', e)
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
  },
  watch: {
    '$route'(to, from) {
      console.log('$route 1', to, from)
      this.currentCategorie = to.split('#')[1] || null
      console.log(this.currentCategorie)
    },
  },
}).$mount('#app')
