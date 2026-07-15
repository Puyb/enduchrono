const { shallowMount } = require('@vue/test-utils')
const Equipes = require('../../src/components/Equipes.vue').default
const { createEquipe, createEquipier, createStoreState } = require('./helpers/factories')

function mountEquipes(equipes, equipiers = {}) {
  const state = createStoreState({ equipes, equipiers })
  return shallowMount(Equipes, {
    mocks: { $store: { state } },
  })
}

describe('Equipes integration', () => {
  const equipes = {
    1: createEquipe({ equipe: 1, nom: 'Equipe 1', categorie: 'A', position_general: 3 }),
    2: createEquipe({ equipe: 2, nom: 'Equipe 2', categorie: 'A', position_general: 1 }),
    3: createEquipe({ equipe: 3, nom: 'Equipe 3', categorie: 'B', position_general: 2 }),
  }
  const equipiers = {
    11: createEquipier({ dossard: 11, nom: 'Nom11', prenom: 'Prenom11' }),
    21: createEquipier({ dossard: 21, nom: 'Nom21', prenom: 'Prenom21' }),
    31: createEquipier({ dossard: 31, nom: 'Nom31', prenom: 'Prenom31' }),
  }

  it('INT-EQUIPES-001 sans filtre categorie, expose toutes les equipes triees par position_general', () => {
    const wrapper = mountEquipes(equipes, equipiers)
    expect(wrapper.vm.equipes.map(e => e.equipe)).toEqual([2, 3, 1])
  })

  it('INT-EQUIPES-002 la liste des categories est deduite des equipes', () => {
    const wrapper = mountEquipes(equipes, equipiers)
    expect(wrapper.vm.categories).toEqual(['A', 'B'])
  })

  it('INT-EQUIPES-003 filtre les equipes par categorie courante', () => {
    const wrapper = mountEquipes(equipes, equipiers)
    wrapper.vm.currentCategorie = 'B'
    expect(wrapper.vm.equipes.map(e => e.equipe)).toEqual([3])
  })

  it('INT-EQUIPES-004 la recherche filtre sur le nom de l\'equipe', () => {
    const wrapper = mountEquipes(equipes, equipiers)
    wrapper.vm.search = 'equipe 3'
    expect(wrapper.vm.equipes.map(e => e.equipe)).toEqual([3])
  })

  it('INT-EQUIPES-005 la recherche inclut le nom/prenom/dossard des equipiers', () => {
    const wrapper = mountEquipes(equipes, equipiers)
    wrapper.vm.search = 'prenom21'
    expect(wrapper.vm.equipes.map(e => e.equipe)).toEqual([2])
  })

  it('INT-EQUIPES-006 la recherche filtre par dossard equipier', () => {
    const wrapper = mountEquipes(equipes, equipiers)
    wrapper.vm.search = '31'
    expect(wrapper.vm.equipes.map(e => e.equipe)).toEqual([3])
  })

  it('INT-EQUIPES-007 combine filtre categorie et recherche', () => {
    const wrapper = mountEquipes(equipes, equipiers)
    wrapper.vm.currentCategorie = 'A'
    wrapper.vm.search = 'equipe 3'
    expect(wrapper.vm.equipes).toEqual([])
  })
})
