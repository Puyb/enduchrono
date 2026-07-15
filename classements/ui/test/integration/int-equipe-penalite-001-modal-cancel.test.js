const { shallowMount } = require('@vue/test-utils')
const EquipePenalite = require('../../src/components/EquipePenalite.vue').default
const { createEquipe, createStoreState } = require('./helpers/factories')

function mountEquipePenalite(equipe, extraState = {}) {
  const state = createStoreState({ equipes: { [equipe.equipe]: equipe }, ...extraState })
  const wrapper = shallowMount(EquipePenalite, {
    propsData: { equipe },
    mocks: { $store: { state } },
  })
  wrapper.vm.$root.URL = state.URL
  return wrapper
}

describe('EquipePenalite modal integration', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({})
  })

  it('INT-EQUIPE-PENALITE-001 n\'applique aucun changement si la modale est annulee (bouton Annuler)', async () => {
    const equipe = createEquipe({ equipe: 1, penalite: 0 })
    const wrapper = mountEquipePenalite(equipe)
    wrapper.vm.newPenalite = -2
    const modal = wrapper.findComponent({ name: 'BModal' })

    modal.vm.$emit('cancel')
    await wrapper.vm.$nextTick()

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('INT-EQUIPE-PENALITE-002 n\'applique aucun changement si la modale est fermee (croix / ESC / backdrop)', async () => {
    const equipe = createEquipe({ equipe: 1, penalite: 0 })
    const wrapper = mountEquipePenalite(equipe)
    wrapper.vm.newPenalite = -2
    const modal = wrapper.findComponent({ name: 'BModal' })

    modal.vm.$emit('hide')
    await wrapper.vm.$nextTick()

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('INT-EQUIPE-PENALITE-003 applique le changement uniquement sur validation (ok)', async () => {
    const equipe = createEquipe({ equipe: 1, penalite: 0 })
    const wrapper = mountEquipePenalite(equipe)
    wrapper.vm.newPenalite = -2
    const modal = wrapper.findComponent({ name: 'BModal' })

    modal.vm.$emit('ok')
    await wrapper.vm.$nextTick()

    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/equipe/1', {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ penalite: -2 }),
    })
  })
})
