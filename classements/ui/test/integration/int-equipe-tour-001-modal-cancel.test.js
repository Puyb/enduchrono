const { shallowMount } = require('@vue/test-utils')
const EquipierTour = require('../../src/components/EquipierTour.vue').default
const { createEquipe, createEquipier, createTour, createStoreState } = require('./helpers/factories')

function mountEquipierTour(equipier, extraState = {}) {
  const state = createStoreState({
    equipes: { 1: createEquipe({ equipe: 1, categorie: 'A', tours: 3, temps: 100000, position_general: 1, position_categorie: 1 }) },
    tours: [createTour({ id: 1, dossard: 11, status: null, timestamp: 60000, duree: 60000 })],
    course: { status: 'COURSE' },
    time: 90000,
    ...extraState,
  })
  const wrapper = shallowMount(EquipierTour, {
    propsData: { equipier },
    mocks: { $store: { state } },
  })
  wrapper.vm.$root.URL = state.URL
  return wrapper
}

describe('EquipierTour modal integration', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({})
  })

  const equipier = createEquipier({ dossard: 11 })

  it('INT-EQUIPE-TOUR-001 n\'applique aucun changement si la modale est annulee (bouton Annuler)', async () => {
    const wrapper = mountEquipierTour(equipier)
    wrapper.vm.newPassageStr = '00:01:30.000'
    const modal = wrapper.findComponent({ name: 'BModal' })

    modal.vm.$emit('cancel')
    await wrapper.vm.$nextTick()

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('INT-EQUIPE-TOUR-002 n\'applique aucun changement si la modale est fermee (croix / ESC / backdrop)', async () => {
    const wrapper = mountEquipierTour(equipier)
    wrapper.vm.newPassageStr = '00:01:30.000'
    const modal = wrapper.findComponent({ name: 'BModal' })

    modal.vm.$emit('hide')
    await wrapper.vm.$nextTick()

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('INT-EQUIPE-TOUR-003 applique l\'ajout de tour uniquement sur validation (ok)', async () => {
    const wrapper = mountEquipierTour(equipier)
    wrapper.vm.newPassageStr = '00:01:30.000'
    const modal = wrapper.findComponent({ name: 'BModal' })

    modal.vm.$emit('ok')
    await wrapper.vm.$nextTick()

    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/tour', {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dossard: 11, timestamp: 90000, source: 'manuel' }),
    })
  })
})
