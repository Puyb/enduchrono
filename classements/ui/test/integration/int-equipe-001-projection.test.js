const { shallowMount, mount } = require('@vue/test-utils')
// EquipierChart importe vue-chartjs (ESM), non transpilable par Jest ; il n'est
// pas concerne par ce test (assertions via shallowMount sur les autres sous-composants).
jest.mock('../../src/components/EquipierChart.vue', () => ({ name: 'EquipierChart', render: h => h('div') }))
const Equipe = require('../../src/components/Equipe.vue').default
const EquipePenalite = require('../../src/components/EquipePenalite.vue').default
const EquipeCategorie = require('../../src/components/EquipeCategorie.vue').default
const EquipierTour = require('../../src/components/EquipierTour.vue').default
const EquipierTranspondeurs = require('../../src/components/EquipierTranspondeurs.vue').default
const { createEquipe, createEquipier, createTour, createStoreState } = require('./helpers/factories')

function mountEquipe(numero, state, teamTours = []) {
  const wrapper = shallowMount(Equipe, {
    propsData: { numero },
    mocks: { $store: { state: createStoreState(state) } },
  })
  // teamTours est desormais alimente par un fetch async (GET /tours?equipe=...) ;
  // on l'injecte directement en donnee locale pour tester les projections de
  // maniere synchrone, sans dependre de la resolution du fetch mocke.
  wrapper.vm.teamTours = teamTours
  return wrapper
}

describe('Equipe integration', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ tours: [], hasMore: false }) })
  })

  const equipes = {
    1: createEquipe({ equipe: 1, nom: 'Equipe 1', categorie: 'A' }),
  }
  const equipiers = {
    11: createEquipier({ dossard: 11, nom: 'Nom11', prenom: 'Prenom11', transpondeurs: [] }),
    12: createEquipier({ dossard: 12, nom: 'Nom12', prenom: 'Prenom12', transpondeurs: [] }),
  }

  it('INT-EQUIPE-001 projette le nombre de tours, le dernier passage et la duree moyenne par equipier', () => {
    const tours = [
      createTour({ id: 1, dossard: 11, status: null, timestamp: 60000, duree: 30000 }),
      createTour({ id: 2, dossard: 11, status: null, timestamp: 90000, duree: 30000 }),
      createTour({ id: 3, dossard: 12, status: null, timestamp: 45000, duree: 45000 }),
      // tours d'une autre equipe : ne doivent pas etre comptes
      createTour({ id: 4, dossard: 21, status: null, timestamp: 999999, duree: 1000 }),
    ]
    const wrapper = mountEquipe('1', { equipes, equipiers, course: { status: 'COURSE' } }, tours)

    const equipier11 = wrapper.vm.equipiers.find(e => e.dossard === 11)
    expect(equipier11.tours).toBe(2)
    expect(equipier11.passage).toBe('00:01:30.000')
    expect(equipier11.duree).toBe('30.000')

    const equipier12 = wrapper.vm.equipiers.find(e => e.dossard === 12)
    expect(equipier12.tours).toBe(1)
  })

  it('INT-EQUIPE-002 la projection des equipiers exclut les tours supprimes/dupliques quel que soit le statut course', () => {
    const tours = [
      createTour({ id: 1, dossard: 11, status: null, timestamp: 10000, duree: 10000 }),
      createTour({ id: 2, dossard: 11, status: 'deleted', timestamp: 20000, duree: 10000 }),
      createTour({ id: 3, dossard: 11, status: 'duplicate', timestamp: 30000, duree: 10000 }),
    ]
    const wrapper = mountEquipe('1', { equipes, equipiers, course: { status: 'COURSE' } }, tours)
    const equipier11 = wrapper.vm.equipiers.find(e => e.dossard === 11)
    expect(equipier11.tours).toBe(1)
  })

  it('INT-EQUIPE-003 la liste des tours (onglet Tours) n\'expose que les tours "ignore" en mode TEST', () => {
    const tours = [
      createTour({ id: 1, dossard: 11, status: 'ignore' }),
      createTour({ id: 2, dossard: 11, status: null }),
    ]
    const wrapper = mountEquipe('1', { equipes, equipiers, course: { status: 'TEST' } }, tours)
    expect(wrapper.vm.tours.map(t => t.id)).toEqual([1])
  })

  it('INT-EQUIPE-004 la liste des tours (onglet Tours) exclut les tours "ignore" hors mode TEST', () => {
    const tours = [
      createTour({ id: 1, dossard: 11, status: 'ignore' }),
      createTour({ id: 2, dossard: 11, status: null }),
      createTour({ id: 3, dossard: 11, status: 'deleted' }),
    ]
    const wrapper = mountEquipe('1', { equipes, equipiers, course: { status: 'COURSE' } }, tours)
    expect(wrapper.vm.tours.map(t => t.id)).toEqual([2, 3])
  })

  it('INT-EQUIPE-005 la liste des tours ne retient que ceux de l\'equipe consultee (deja filtres par l\'API)', () => {
    const tours = [
      createTour({ id: 1, dossard: 11, status: null }),
    ]
    const wrapper = mountEquipe('1', { equipes, equipiers, course: { status: 'COURSE' } }, tours)
    expect(wrapper.vm.tours.map(t => t.id)).toEqual([1])
  })

  it('INT-EQUIPE-006 expose les sous-actions penalite/categorie/tour manuel/transpondeurs par equipier', () => {
    // Necessite un mount complet : EquipierTour/EquipierTranspondeurs sont rendus
    // via un scoped slot de b-table, non evalue par le stub shallowMount.
    const wrapper = mount(Equipe, {
      propsData: { numero: '1' },
      mocks: { $store: { state: createStoreState({ equipes, equipiers, course: { status: 'COURSE' } }) } },
    })
    expect(wrapper.findComponent(EquipePenalite).exists()).toBe(true)
    expect(wrapper.findComponent(EquipeCategorie).exists()).toBe(true)
    expect(wrapper.findComponent(EquipierTour).exists()).toBe(true)
    expect(wrapper.findComponent(EquipierTranspondeurs).exists()).toBe(true)
  })
})
