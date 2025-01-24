import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    URL: '',
    time: 0,
    error: null,
    course: {},
    tours: [],
    equipes: {},
    equipiers: {},
    transpondeurs: [],
    filenames: [],
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
