const { shallowMount } = require('@vue/test-utils')
// ToursMinChart et NoiseChart importent vue-chartjs (ESM), non transpilable par
// Jest ; ils ne sont pas concernes par ce test (assertions sur les computed).
jest.mock('../../src/components/ToursMinChart.vue', () => ({ name: 'ToursMinChart', render: h => h('div') }))
jest.mock('../../src/components/NoiseChart.vue', () => ({ name: 'NoiseChart', render: h => h('div') }))
const Stats = require('../../src/components/Stats.vue').default
const { createTour, createStoreState } = require('./helpers/factories')

function mountStats(state) {
  return shallowMount(Stats, {
    mocks: { $store: { state: createStoreState(state) } },
  })
}

describe('Stats integration', () => {
  it('INT-STATS-001 regroupe les tours valides par bucket minute', () => {
    const MINUTE = 60 * 1000
    const tours = [
      createTour({ id: 1, status: null, timestamp: 0 }),
      createTour({ id: 2, status: null, timestamp: 30 * 1000 }),
      createTour({ id: 3, status: null, timestamp: MINUTE + 1000 }),
      // exclus du calcul : tours non valides
      createTour({ id: 4, status: 'deleted', timestamp: 0 }),
      createTour({ id: 5, status: 'duplicate', timestamp: 0 }),
      createTour({ id: 6, status: 'ignore', timestamp: 0 }),
    ]
    const wrapper = mountStats({ tours, noise: [{ Sta: 1, Box: 1, minSta: 1, minBox: 1 }] })

    expect(wrapper.vm.toursMin).toEqual({
      0: 2,
      [MINUTE]: 1,
    })
  })

  it('INT-STATS-002 expose le dernier releve de bruit', () => {
    const noise = [
      { Sta: 1, Box: 2, minSta: 1, minBox: 2 },
      { Sta: 3, Box: 4, minSta: 1, minBox: 2 },
    ]
    const wrapper = mountStats({ tours: [], noise })
    expect(wrapper.vm.lastNoise).toEqual({ Sta: 3, Box: 4, minSta: 1, minBox: 2 })
  })
})
