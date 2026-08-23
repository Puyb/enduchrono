const { mount } = require('@vue/test-utils')
// TranspondeurChart importe vue-chartjs (ESM), non transpilable par Jest ; il n'est
// pas concerne par ce test (assertions sur le cablage icone -> popup, pas sur le graph).
jest.mock('../../src/components/TranspondeurChart.vue', () => ({ name: 'TranspondeurChart', render: h => h('div') }))
const Transpondeurs = require('../../src/components/Transpondeurs.vue').default
const SignalIcon = require('../../src/components/SignalIcon.vue').default
const BatteryIcon = require('../../src/components/BatteryIcon.vue').default
const { createTranspondeur, createStoreState } = require('./helpers/factories')

function mountTranspondeurs(transpondeurs, extraState = {}) {
  const state = createStoreState({ transpondeurs, ...extraState })
  const $router = { push: jest.fn() }
  // mount complet requis : les icones sont rendues via un scoped slot de b-table
  // (#cell(signal)/#cell(battery)), non evalue par le stub shallowMount (cf. Equipe.vue).
  return mount(Transpondeurs, { mocks: { $store: { state }, $router } })
}

describe('Transpondeurs battery/signal integration', () => {
  it('INT-TRANSPONDEURS-010 affiche la derniere valeur connue et le fallback "jamais vu" sans passage', () => {
    const transpondeurs = [
      createTranspondeur({ id: 'TRP-11', dossard: 11, lastSignal: 95, lastBattery: 1 }),
      createTranspondeur({ id: 'TRP-31', dossard: 31 }), // jamais vu : lastSignal/lastBattery restent null
    ]
    const wrapper = mountTranspondeurs(transpondeurs)

    const signalIcons = wrapper.findAllComponents(SignalIcon)
    const batteryIcons = wrapper.findAllComponents(BatteryIcon)
    expect(signalIcons.at(0).props('value')).toBe(95)
    expect(batteryIcons.at(0).props('value')).toBe(1)
    expect(signalIcons.at(1).props('value')).toBe(null)
    expect(batteryIcons.at(1).props('value')).toBe(null)
  })

  it('INT-TRANSPONDEURS-011 un clic sur une icone ouvre le popup pour ce transpondeur', async () => {
    const transpondeurs = [createTranspondeur({ id: 'TRP-11', dossard: 11, lastBattery: 2 })]
    const wrapper = mountTranspondeurs(transpondeurs)

    expect(wrapper.vm.selectedTranspondeurId).toBe(null)
    await wrapper.findComponent(BatteryIcon).vm.$emit('click', 'TRP-11')
    expect(wrapper.vm.selectedTranspondeurId).toBe('TRP-11')
  })
})
