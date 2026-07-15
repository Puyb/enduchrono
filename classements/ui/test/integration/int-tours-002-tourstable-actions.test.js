const { shallowMount } = require('@vue/test-utils')
const ToursTable = require('../../src/components/ToursTable.vue').default
const { createEquipe, createTour, createStoreState, stubBvModal } = require('./helpers/factories')

function mountToursTable(tours, extraState = {}) {
  const state = createStoreState({
    equipes: { 1: createEquipe({ equipe: 1, nom: 'Equipe 1' }) },
    equipiers: {},
    tours,
    ...extraState,
  })
  const $router = { push: jest.fn() }
  const wrapper = shallowMount(ToursTable, {
    propsData: { tours, fields: [] },
    mocks: {
      $store: { state },
      $router,
    },
  })
  // ToursTable utilise this.$root.URL (et non $store.state.URL) pour les appels fetch.
  wrapper.vm.$root.URL = state.URL
  return { wrapper, $router }
}

describe('ToursTable integration', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({})
  })

  it('INT-TOURS-002-001 supprime un tour normal apres confirmation (DELETE)', async () => {
    const tour = createTour({ id: 42, dossard: 11, status: null })
    const { wrapper } = mountToursTable([tour])
    const bvModal = stubBvModal(wrapper.vm, true)

    await wrapper.vm.deleteTour(tour)

    expect(bvModal.msgBoxConfirm).toHaveBeenCalledWith(
      expect.stringContaining('supprimer le tour 42'),
      expect.objectContaining({ okTitle: 'Supprimer' })
    )
    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/tour/42', { method: 'delete' })
  })

  it('INT-TOURS-002-002 n\'appelle pas fetch si la suppression est annulee', async () => {
    const tour = createTour({ id: 42, dossard: 11, status: null })
    const { wrapper } = mountToursTable([tour])
    stubBvModal(wrapper.vm, false)

    await wrapper.vm.deleteTour(tour)

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('INT-TOURS-002-003 restaure un tour supprime apres confirmation (POST status null)', async () => {
    const tour = createTour({ id: 43, dossard: 11, status: 'deleted' })
    const { wrapper } = mountToursTable([tour])
    const bvModal = stubBvModal(wrapper.vm, true)

    await wrapper.vm.deleteTour(tour)

    expect(bvModal.msgBoxConfirm).toHaveBeenCalledWith(
      expect.stringContaining('restaurer le tour 43'),
      expect.objectContaining({ okTitle: 'Restaurer' })
    )
    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/tour/43', {
      method: 'post',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: null }),
    })
  })

  it('INT-TOURS-002-004 restaure un tour duplique apres confirmation', async () => {
    const tour = createTour({ id: 44, dossard: 11, status: 'duplicate' })
    const { wrapper } = mountToursTable([tour])
    stubBvModal(wrapper.vm, true)

    await wrapper.vm.deleteTour(tour)

    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/tour/44', {
      method: 'post',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: null }),
    })
  })

  it('INT-TOURS-002-005 applique la classe visuelle "deleted" en rouge', () => {
    const { wrapper } = mountToursTable([])
    const classes = wrapper.vm.rowClass(createTour({ status: 'deleted' }), 'row')
    expect(classes).toContain('text-decoration-line-through-red')
  })

  it('INT-TOURS-002-006 applique la classe visuelle "duplicate" en bleu', () => {
    const { wrapper } = mountToursTable([])
    const classes = wrapper.vm.rowClass(createTour({ status: 'duplicate' }), 'row')
    expect(classes).toContain('text-decoration-line-through-blue')
  })

  it('INT-TOURS-002-007 n\'ajoute aucune classe visuelle pour un tour normal', () => {
    const { wrapper } = mountToursTable([])
    const classes = wrapper.vm.rowClass(createTour({ status: null }), 'row')
    expect(classes).toEqual([])
  })

  it('INT-TOURS-002-008 navigue vers la fiche equipe depuis le dossard du tour', () => {
    const { wrapper, $router } = mountToursTable([])
    wrapper.vm.showEquipe(11)
    expect($router.push).toHaveBeenCalledWith('/equipe/1')
  })
})
