const { shallowMount } = require('@vue/test-utils')
const EquipierTranspondeurs = require('../../src/components/EquipierTranspondeurs.vue').default
const BatteryIcon = require('../../src/components/BatteryIcon.vue').default
const { createEquipier, createTranspondeur, createStoreState } = require('./helpers/factories')

function mountComponent(equipier, extraState = {}) {
  const state = createStoreState(extraState)
  return shallowMount(EquipierTranspondeurs, {
    propsData: { equipier },
    mocks: { $store: { state } },
  })
}

describe('EquipierTranspondeurs battery icon integration', () => {
  it("INT-EQUIPIER-TRANSPONDEURS-002 utilise la batterie live du store, pas la copie figee sur l'equipier", () => {
    // Copie figee au moment de l'affectation (pas de lastBattery) : c'est ce qui est
    // embarque sur equipier.transpondeurs, jamais mis a jour cote client a chaque passage.
    const staleTranspondeur = { id: 'TP-11', dossard: 11, deleted: false }
    const equipier = createEquipier({ dossard: 11, transpondeurs: [staleTranspondeur] })
    // Valeur live tenue a jour par le websocket (store.state.transpondeurs).
    const liveTranspondeurs = [createTranspondeur({ id: 'TP-11', dossard: 11, lastBattery: 0 })]

    const wrapper = mountComponent(equipier, { transpondeurs: liveTranspondeurs })

    expect(wrapper.findComponent(BatteryIcon).props('value')).toBe(0)
  })

  it('INT-EQUIPIER-TRANSPONDEURS-003 fallback "jamais vu" si le transpondeur est absent du store live', () => {
    const equipier = createEquipier({ dossard: 11, transpondeurs: [{ id: 'TP-11', dossard: 11, deleted: false }] })
    const wrapper = mountComponent(equipier, { transpondeurs: [] })

    // liveBattery() renvoie undefined ; Vue retombe alors sur le defaut du prop (null),
    // que BatteryIcon traite comme "jamais vu" (meme rendu que value: null explicite).
    expect(wrapper.findComponent(BatteryIcon).props('value')).toBe(null)
  })

  it("INT-EQUIPIER-TRANSPONDEURS-004 un clic sur l'icone remonte l'evenement show-transpondeur", async () => {
    const equipier = createEquipier({ dossard: 11, transpondeurs: [{ id: 'TP-11', dossard: 11, deleted: false }] })
    const wrapper = mountComponent(equipier, { transpondeurs: [createTranspondeur({ id: 'TP-11', dossard: 11, lastBattery: 3 })] })

    await wrapper.findComponent(BatteryIcon).vm.$emit('click', 'TP-11')
    expect(wrapper.emitted('show-transpondeur')).toEqual([['TP-11']])
  })
})
