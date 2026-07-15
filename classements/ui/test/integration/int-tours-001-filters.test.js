const { shallowMount } = require('@vue/test-utils')
const Tours = require('../../src/components/Tours.vue').default

function mountTours(tours, status = 'COURSE') {
  return shallowMount(Tours, {
    mocks: {
      $store: {
        state: {
          course: { status },
          tours,
        },
      },
    },
    stubs: {
      ToursTable: true,
    },
  })
}

describe('Tours integration', () => {
  it('INT-TOURS-001 applique les filtres de statut sur les tours', () => {
    const wrapper = mountTours([
      { id: 1, dossard: 11, status: null, transpondeur: 'A' },
      { id: 2, dossard: 11, status: 'duplicate', transpondeur: 'A' },
      { id: 3, dossard: 11, status: 'ignore', transpondeur: 'A' },
      { id: 4, dossard: 11, status: 'deleted', transpondeur: 'A' },
      { id: 5, dossard: null, status: null, transpondeur: 'UNKNOWN' },
    ])

    expect(wrapper.vm.toursAll.map(t => t.id)).toEqual([1, 2, 4, 5])
    expect(wrapper.vm.toursNormaux.map(t => t.id)).toEqual([1])
    expect(wrapper.vm.toursDuplicate.map(t => t.id)).toEqual([2])
    expect(wrapper.vm.toursDeleted.map(t => t.id)).toEqual([4])
    expect(wrapper.vm.toursUnknown.map(t => t.id)).toEqual([5])
  })

  it('INT-TOURS-003 n\'expose que les tours "ignore" en mode TEST', () => {
    const wrapper = mountTours([
      { id: 1, dossard: 11, status: 'ignore', transpondeur: 'A' },
      { id: 2, dossard: 11, status: null, transpondeur: 'A' },
    ], 'TEST')

    expect(wrapper.vm.toursAll.map(t => t.id)).toEqual([1])
  })

  it('INT-TOURS-004 filtre toursSelected par recherche multi-mots (transpondeur + dossard)', () => {
    const wrapper = mountTours([
      { id: 1, dossard: 11, status: null, transpondeur: 'TRP-A-11' },
      { id: 2, dossard: 21, status: null, transpondeur: 'TRP-A-21' },
      { id: 3, dossard: 31, status: null, transpondeur: 'TRP-B-31' },
    ])
    wrapper.vm.selection = 'toursNormaux'

    wrapper.vm.search = 'trp-a'
    expect(wrapper.vm.toursSelected.map(t => t.id)).toEqual([1, 2])

    wrapper.vm.search = 'trp-a 21'
    expect(wrapper.vm.toursSelected.map(t => t.id)).toEqual([2])

    wrapper.vm.search = ''
    expect(wrapper.vm.toursSelected.map(t => t.id)).toEqual([1, 2, 3])
  })
})
