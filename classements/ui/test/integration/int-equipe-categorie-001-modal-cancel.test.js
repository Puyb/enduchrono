const { shallowMount } = require('@vue/test-utils')
const EquipeCategorie = require('../../src/components/EquipeCategorie.vue').default
const { createEquipe, createStoreState } = require('./helpers/factories')

function mountEquipeCategorie(equipe, extraState = {}) {
  const state = createStoreState({
    equipes: { [equipe.equipe]: equipe },
    categories: ['A', 'B'],
    ...extraState,
  })
  const wrapper = shallowMount(EquipeCategorie, {
    propsData: { equipe },
    mocks: { $store: { state } },
  })
  wrapper.vm.$root.URL = state.URL
  return wrapper
}

describe('EquipeCategorie modal integration', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({})
  })

  it('INT-EQUIPE-CATEGORIE-001 n\'applique aucun changement si la modale est annulee (bouton Annuler)', async () => {
    const equipe = createEquipe({ equipe: 1, categorie: 'A' })
    const wrapper = mountEquipeCategorie(equipe)
    wrapper.vm.newCategorie = 'B'
    const modal = wrapper.findComponent({ name: 'BModal' })

    modal.vm.$emit('cancel')
    await wrapper.vm.$nextTick()

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('INT-EQUIPE-CATEGORIE-002 n\'applique aucun changement si la modale est fermee (croix / ESC / backdrop)', async () => {
    const equipe = createEquipe({ equipe: 1, categorie: 'A' })
    const wrapper = mountEquipeCategorie(equipe)
    wrapper.vm.newCategorie = 'B'
    const modal = wrapper.findComponent({ name: 'BModal' })

    modal.vm.$emit('hide')
    await wrapper.vm.$nextTick()

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('INT-EQUIPE-CATEGORIE-003 applique le changement uniquement sur validation (ok)', async () => {
    const equipe = createEquipe({ equipe: 1, categorie: 'A' })
    const wrapper = mountEquipeCategorie(equipe)
    wrapper.vm.newCategorie = 'B'
    const modal = wrapper.findComponent({ name: 'BModal' })

    modal.vm.$emit('ok')
    await wrapper.vm.$nextTick()

    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/equipe/1', {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categorie: 'B' }),
    })
  })
})
