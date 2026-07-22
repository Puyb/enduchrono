import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    URL: '',
    time: 0,
    error: null,
    errorMessage: null,
    course: {},
    tours: [],
    toursCounts: { all: 0, normaux: 0, duplicate: 0, deleted: 0, unknown: 0 },
    toursPerMinute: {},
    newToursSincePage1: 0,
    toursLiveMode: true,
    wsInitCount: 0,
    equipes: {},
    equipiers: {},
    transpondeurs: [],
    filenames: [],
    pending: 0,
    noise: [],
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
