// vue-chartjs/legacy et chart.js posent le meme probleme ESM que pour EquipierChart/NoiseChart
// (non transpilable par Jest) : on mocke uniquement la lib de graph, pas le composant lui-meme,
// pour pouvoir verifier son vrai comportement (fetch + construction des datasets).
jest.mock('vue-chartjs/legacy', () => ({ Line: { name: 'LineChartGenerator', render: h => h('div') } }))
jest.mock('chart.js', () => ({
  Chart: { register: jest.fn() },
  Title: {}, Tooltip: {}, Legend: {}, LineElement: {}, LinearScale: {}, CategoryScale: {}, PointElement: {},
}))

const { shallowMount } = require('@vue/test-utils')
const TranspondeurChart = require('../../src/components/TranspondeurChart.vue').default

function mountChart(transpondeurId) {
  return shallowMount(TranspondeurChart, {
    propsData: { transpondeurId },
    mocks: { $root: { URL: 'http://classements.test' } },
  })
}

describe('TranspondeurChart integration', () => {
  it("INT-TRANSPONDEUR-CHART-001 recupere l'historique du transpondeur et construit les 3 series chronologiquement", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      // /tours renvoie du plus recent au plus ancien (meme convention que GET /tours)
      json: async () => ({
        tours: [
          { timestamp: 3000, signal: 60, detectionCount: 1, battery: 1 },
          { timestamp: 2000, signal: 80, detectionCount: 1, battery: 2 },
          { timestamp: 1000, signal: 95, detectionCount: 2, battery: 3 },
        ],
      }),
    })

    const wrapper = mountChart('TP-11')
    await wrapper.vm.$nextTick()
    await Promise.resolve()
    await Promise.resolve()

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tours?transpondeur=TP-11'))
    const { datasets } = wrapper.vm.chartData
    expect(datasets.find(d => d.label === 'Signal').data).toEqual([95, 80, 60])
    expect(datasets.find(d => d.label === 'Détections').data).toEqual([2, 1, 1])
    expect(datasets.find(d => d.label === 'Batterie').data).toEqual([3, 2, 1])
  })

  it('INT-TRANSPONDEUR-CHART-002 invisible et sans fetch quand aucun transpondeur n\'est selectionne', () => {
    global.fetch = jest.fn()
    const wrapper = mountChart(null)
    expect(wrapper.vm.visible).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
