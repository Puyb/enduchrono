const { shallowMount } = require('@vue/test-utils')
const Tours = require('../../src/components/Tours.vue').default

describe('Tours integration', () => {
  it('INT-TOURS-001 applique les filtres de statut sur les tours', () => {
    const wrapper = shallowMount(Tours, {
      mocks: {
        $store: {
          state: {
            course: { status: 'COURSE' },
            tours: [
              { id: 1, dossard: 11, status: null, transpondeur: 'A' },
              { id: 2, dossard: 11, status: 'duplicate', transpondeur: 'A' },
              { id: 3, dossard: 11, status: 'ignore', transpondeur: 'A' },
              { id: 4, dossard: 11, status: 'deleted', transpondeur: 'A' },
              { id: 5, dossard: null, status: null, transpondeur: 'UNKNOWN' },
            ],
          },
        },
      },
      stubs: {
        ToursTable: true,
      },
    })

    expect(wrapper.vm.toursAll.map(t => t.id)).toEqual([1, 2, 4, 5])
    expect(wrapper.vm.toursNormaux.map(t => t.id)).toEqual([1])
    expect(wrapper.vm.toursDuplicate.map(t => t.id)).toEqual([2])
    expect(wrapper.vm.toursDeleted.map(t => t.id)).toEqual([4])
    expect(wrapper.vm.toursUnknown.map(t => t.id)).toEqual([5])
  })
})
