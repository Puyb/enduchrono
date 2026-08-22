const { shallowMount } = require('@vue/test-utils')
const EquipeNonPartante = require('../../src/components/EquipeNonPartante.vue').default
const { createEquipe, createStoreState } = require('./helpers/factories')

function mountEquipeNonPartante(equipe, extraState = {}) {
  const state = createStoreState({ equipes: { [equipe.equipe]: equipe }, ...extraState })
  const wrapper = shallowMount(EquipeNonPartante, {
    propsData: { equipe },
    mocks: { $store: { state } },
  })
  wrapper.vm.$root.URL = state.URL
  return wrapper
}

describe('EquipeNonPartante toggle integration', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({})
  })

  it('INT-EQUIPE-NON-PARTANTE-001 passe une equipe partante en non partante', async () => {
    const equipe = createEquipe({ equipe: 1, non_partante: false })
    const wrapper = mountEquipeNonPartante(equipe)

    await wrapper.vm.toggle()

    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/equipe/1', {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ non_partante: true }),
    })
  })

  it('INT-EQUIPE-NON-PARTANTE-002 retire le statut non partant d\'une equipe', async () => {
    const equipe = createEquipe({ equipe: 1, non_partante: true })
    const wrapper = mountEquipeNonPartante(equipe)

    await wrapper.vm.toggle()

    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/equipe/1', {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ non_partante: false }),
    })
  })
})
