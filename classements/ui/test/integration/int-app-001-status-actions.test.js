const { shallowMount } = require('@vue/test-utils')
const App = require('../../src/App.vue').default
const { createStoreState, createTour, stubBvModal } = require('./helpers/factories')

function mountApp(state) {
  return shallowMount(App, {
    mocks: {
      $store: { state },
      $route: { name: 'tours' },
    },
    stubs: {
      'router-view': true,
    },
  })
}

describe('App integration', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({})
  })

  it('INT-APP-001 affiche le formulaire de nouvelle course quand aucune course n\'est chargee', () => {
    const wrapper = mountApp({ ...createStoreState(), course: null })
    expect(wrapper.text()).toContain('Nouvelle course')
    expect(wrapper.find('b-navbar-stub').exists()).toBe(false)
  })

  it('INT-APP-002 affiche la navbar et les compteurs quand une course est chargee', () => {
    const state = createStoreState({
      course: { status: 'COURSE', name: 'Ma Course' },
      tours: [createTour({ id: 1, status: null }), createTour({ id: 2, status: 'ignore' })],
      equipes: { 1: {} },
      transpondeurs: [{ id: 'T1' }],
    })
    const wrapper = mountApp(state)
    expect(wrapper.text()).toContain('Ma Course')
    expect(wrapper.vm.toursAll).toHaveLength(1)
    expect(wrapper.vm.transpondeursAll).toHaveLength(1)
  })

  it.each([
    ['TEST', 'Test avant course'],
    ['DEPART', 'Attente départ'],
    ['COURSE', 'tour'],
    ['FIN', 'Course terminée'],
  ])('INT-APP-003 affiche le texte de statut attendu pour %s', (status, expectedText) => {
    const state = createStoreState({ course: { status, name: 'Course' } })
    const wrapper = mountApp(state)
    expect(wrapper.text()).toContain(expectedText)
  })

  it('INT-APP-004 bascule toursAll sur les tours "ignore" en mode TEST', () => {
    const state = createStoreState({
      course: { status: 'TEST', name: 'Course' },
      tours: [createTour({ id: 1, status: 'ignore' }), createTour({ id: 2, status: null })],
    })
    const wrapper = mountApp(state)
    expect(wrapper.vm.toursAll.map(t => t.id)).toEqual([1])
  })

  it('INT-APP-005 showDepart est actif uniquement en statut DEPART', () => {
    const wrapperDepart = mountApp(createStoreState({ course: { status: 'DEPART' } }))
    expect(wrapperDepart.vm.showDepart).toBe(true)

    const wrapperCourse = mountApp(createStoreState({ course: { status: 'COURSE' } }))
    expect(wrapperCourse.vm.showDepart).toBe(false)
  })

  it.each(['chronelec', 'chrono', 'classement'])('INT-APP-006 showError est actif pour une erreur %s', (error) => {
    const wrapper = mountApp(createStoreState({ error }))
    expect(wrapper.vm.showError).toBe(true)
  })

  it('INT-APP-006b showError est inactif sans erreur', () => {
    const wrapper = mountApp(createStoreState({ error: null }))
    expect(wrapper.vm.showError).toBe(false)
  })

  it('INT-APP-007 startTest appelle POST /test/start', async () => {
    const wrapper = mountApp(createStoreState({ course: { status: 'TEST' } }))
    await wrapper.vm.startTest()
    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/test/start', { method: 'POST' })
  })

  it('INT-APP-008 stopTest appelle POST /test/stop', async () => {
    const wrapper = mountApp(createStoreState({ course: { status: 'TEST' } }))
    await wrapper.vm.stopTest()
    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/test/stop', { method: 'POST' })
  })

  it('INT-APP-009 startCourse appelle POST /course/start', async () => {
    const wrapper = mountApp(createStoreState({ course: { status: 'DEPART' } }))
    await wrapper.vm.startCourse()
    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/course/start', { method: 'POST' })
  })

  it('INT-APP-010 closeCourse appelle POST /course/close', async () => {
    const wrapper = mountApp(createStoreState({ course: { status: 'FIN' } }))
    await wrapper.vm.closeCourse()
    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/course/close', { method: 'POST' })
  })

  it('INT-APP-011 openCourse appelle POST /course/open avec le filename', async () => {
    const wrapper = mountApp(createStoreState({ course: null }))
    await wrapper.vm.openCourse('course_a.db')
    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/course/open', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: 'course_a.db' }),
    })
  })

  it('INT-APP-012 stopCourse appelle POST /course/stop uniquement apres confirmation', async () => {
    const wrapper = mountApp(createStoreState({ course: { status: 'COURSE' } }))
    const bvModalConfirm = stubBvModal(wrapper.vm, true)
    await wrapper.vm.stopCourse()
    expect(bvModalConfirm.msgBoxConfirm).toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/course/stop', { method: 'POST' })
  })

  it('INT-APP-013 stopCourse n\'appelle pas fetch si la confirmation est annulee', async () => {
    const wrapper = mountApp(createStoreState({ course: { status: 'COURSE' } }))
    const bvModalConfirm = stubBvModal(wrapper.vm, false)
    await wrapper.vm.stopCourse()
    expect(bvModalConfirm.msgBoxConfirm).toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
