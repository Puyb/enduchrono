import Vue from 'vue'
import App from './App.vue'
import { BootstrapVue } from 'bootstrap-vue'
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'
Vue.use(BootstrapVue)

Vue.config.productionTip = false

import store from './store'
new Vue({
  render: h => h(App),
  store,
  mounted(){
    this.URL = location.origin
    if (window.webpackHotUpdate) { // dev mode
      this.URL = this.URL.replace(':8081', ':3002')
    }
    this.$store.state.URL = this.URL
    
    const connect = () => {
      const connection = new WebSocket(`${this.URL.replace(/^http/, 'ws')}/ws`)
      connection.onmessage = (message) => {
        const data = JSON.parse(message.data)
        console.log('data', data, data.equipe?.equipe)
        if (data.timeString) Object.assign(this.$store.state, data)
      }
      connection.onclose = (e) => {
        console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason);
        setTimeout(function() {
          connect();
        }, 1000);
      };
    }
    connect()
  }
}).$mount('#app')
