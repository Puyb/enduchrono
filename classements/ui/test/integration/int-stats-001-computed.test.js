const { shallowMount } = require('@vue/test-utils')
// ToursMinChart et NoiseChart importent vue-chartjs (ESM), non transpilable par
// Jest ; ils ne sont pas concernes par ce test (assertions sur les computed).
jest.mock('../../src/components/ToursMinChart.vue', () => ({ name: 'ToursMinChart', render: h => h('div') }))
jest.mock('../../src/components/NoiseChart.vue', () => ({ name: 'NoiseChart', render: h => h('div') }))
const Stats = require('../../src/components/Stats.vue').default
const { createStoreState } = require('./helpers/factories')

function mountStats(state) {
  return shallowMount(Stats, {
    mocks: { $store: { state: createStoreState(state) } },
  })
}

describe('Stats integration', () => {
  it('INT-STATS-001 expose l\'histogramme tours/minute et le total fournis par le store (agreges cote serveur)', () => {
    const MINUTE = 60 * 1000
    const toursPerMinute = { 0: 2, [MINUTE]: 1 }
    const wrapper = mountStats({
      toursPerMinute,
      toursCounts: { all: 3, normaux: 3, duplicate: 0, deleted: 0, unknown: 0 },
      noise: [{ Sta: 1, Box: 1, minSta: 1, minBox: 1 }],
    })

    expect(wrapper.vm.toursMin).toEqual(toursPerMinute)
    expect(wrapper.vm.$store.state.toursCounts.all).toBe(3)
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
