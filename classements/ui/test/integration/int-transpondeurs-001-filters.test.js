const { shallowMount } = require('@vue/test-utils')
const Transpondeurs = require('../../src/components/Transpondeurs.vue').default
const { createEquipe, createEquipier, createTour, createTranspondeur, createStoreState } = require('./helpers/factories')

function mountTranspondeurs(transpondeurs, extraState = {}) {
  const state = createStoreState({ transpondeurs, ...extraState })
  const $router = { push: jest.fn() }
  const wrapper = shallowMount(Transpondeurs, {
    mocks: { $store: { state }, $router },
  })
  return { wrapper, $router }
}

describe('Transpondeurs integration', () => {
  const transpondeurs = [
    createTranspondeur({ id: 'TRP-11', dossard: 11, deleted: false }),
    createTranspondeur({ id: 'TRP-21', dossard: 21, deleted: true }),
    createTranspondeur({ id: 'TRP-31', dossard: 31, deleted: false }),
    createTranspondeur({ id: 'TRP-UNKNOWN', dossard: null, deleted: false }),
  ]
  const tours = [
    createTour({ id: 1, dossard: 11, transpondeur: 'TRP-11', status: null }),
  ]

  it('INT-TRANSPONDEURS-001 transpondeursActive ne retient que les transpondeurs affectes et non desactives', () => {
    const { wrapper } = mountTranspondeurs(transpondeurs, { tours })
    expect(wrapper.vm.transpondeursActive.map(t => t.id)).toEqual(['TRP-11', 'TRP-31'])
  })

  it('INT-TRANSPONDEURS-002 transpondeursInactive ne retient que les transpondeurs desactives', () => {
    const { wrapper } = mountTranspondeurs(transpondeurs, { tours })
    expect(wrapper.vm.transpondeursInactive.map(t => t.id)).toEqual(['TRP-21'])
  })

  it('INT-TRANSPONDEURS-003 transpondeursUnknown ne retient que les transpondeurs sans dossard', () => {
    const { wrapper } = mountTranspondeurs(transpondeurs, { tours })
    expect(wrapper.vm.transpondeursUnknown.map(t => t.id)).toEqual(['TRP-UNKNOWN'])
  })

  it('INT-TRANSPONDEURS-004 transpondeursNeverSeenCourse retient les transpondeurs affectes sans passage hors TEST', () => {
    const { wrapper } = mountTranspondeurs(transpondeurs, { tours })
    // TRP-11 a un passage non-ignore ; TRP-21 (bien que desactive) et TRP-31 n'en ont aucun
    expect(wrapper.vm.transpondeursNeverSeenCourse.map(t => t.id).sort()).toEqual(['TRP-21', 'TRP-31'])
  })

  it('INT-TRANSPONDEURS-005 transpondeursNeverSeen retient les transpondeurs affectes sans aucun passage', () => {
    // passages est desormais un compteur serveur (registerTourStats), incremente
    // quel que soit le statut du tour (y compris "ignore").
    const transpondeursWithPassages = [
      createTranspondeur({ id: 'TRP-11', dossard: 11, deleted: false, passages: 0 }),
      createTranspondeur({ id: 'TRP-21', dossard: 21, deleted: true, passages: 1 }),
      createTranspondeur({ id: 'TRP-31', dossard: 31, deleted: false, passages: 0 }),
      createTranspondeur({ id: 'TRP-UNKNOWN', dossard: null, deleted: false, passages: 0 }),
    ]
    const { wrapper } = mountTranspondeurs(transpondeursWithPassages)
    // TRP-21 a un passage (meme ignore) donc pas "jamais vu"; TRP-11 et TRP-31 n'en ont aucun
    expect(wrapper.vm.transpondeursNeverSeen.map(t => t.id).sort()).toEqual(['TRP-11', 'TRP-31'])
  })

  it('INT-TRANSPONDEURS-006 la recherche filtre par equipier/equipe/categorie', () => {
    const state = {
      tours,
      equipes: { 1: createEquipe({ equipe: 1, nom: 'Equipe 1', categorie: 'A' }) },
      equipiers: { 11: createEquipier({ dossard: 11, nom: 'Nom11', prenom: 'Prenom11' }) },
    }
    const { wrapper } = mountTranspondeurs(transpondeurs, state)
    wrapper.vm.selection = 'transpondeursAll'

    wrapper.vm.search = 'nom11'
    expect(wrapper.vm.transpondeursSelected.map(t => t.id)).toEqual(['TRP-11'])

    wrapper.vm.search = 'categorie a'
    expect(wrapper.vm.transpondeursSelected.map(t => t.id)).toEqual([])

    wrapper.vm.search = ''
    expect(wrapper.vm.transpondeursSelected).toHaveLength(4)
  })

  it('INT-TRANSPONDEURS-007 rowClass signale les transpondeurs inconnus et desactives', () => {
    const { wrapper } = mountTranspondeurs(transpondeurs, { tours })
    expect(wrapper.vm.rowClass(transpondeurs[3], 'row')).toBe('table-danger')
    expect(wrapper.vm.rowClass(transpondeurs[1], 'row')).toBe('table-warning')
    expect(wrapper.vm.rowClass(transpondeurs[0], 'row')).toBeUndefined()
  })

  it('INT-TRANSPONDEURS-008 showEquipe navigue vers la fiche equipe depuis le dossard', () => {
    const { wrapper, $router } = mountTranspondeurs(transpondeurs, { tours })
    wrapper.vm.showEquipe(11)
    expect($router.push).toHaveBeenCalledWith('/equipe/1')
  })
})
