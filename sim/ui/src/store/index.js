import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    URL: '',
    status: '',
    timestamp: 0,
    timeString: '',
    sent: 0,
    pending: 0,
    futur: 0,
  },
  mutations: {
    setStatus(state, status) {
      state.course.status = status
    }
  },
  actions: {
  },
  modules: {
  }
})
