const { shallowMount, mount } = require('@vue/test-utils')
jest.mock('../../src/components/EquipierChart.vue', () => ({ name: 'EquipierChart', render: h => h('div') }))
const Equipe = require('../../src/components/Equipe.vue').default
const EquipeNonPartante = require('../../src/components/EquipeNonPartante.vue').default
const { createEquipe, createEquipier, createStoreState } = require('./helpers/factories')

function mountEquipe(numero, state, { fullMount = false } = {}) {
  const mountFn = fullMount ? mount : shallowMount
  const storeState = createStoreState(state)
  const wrapper = mountFn(Equipe, {
    propsData: { numero },
    mocks: { $store: { state: storeState } },
  })
  wrapper.vm.$root.URL = storeState.URL
  wrapper.vm.teamTours = []
  return wrapper
}

describe('Equipe commentaire/telephone/non_partante integration', () => {
  const equipiers = {
    11: createEquipier({ dossard: 11, nom: 'Nom11', prenom: 'Prenom11', transpondeurs: [] }),
  }

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ tours: [], hasMore: false }) })
  })

  it('INT-EQUIPE-COMMENTAIRE-001 pre-remplit le commentaire existant de l\'equipe', () => {
    const equipes = { 1: createEquipe({ equipe: 1, commentaire: 'A contacter avant le depart' }) }
    const wrapper = mountEquipe('1', { equipes, equipiers, course: { status: 'COURSE' } })

    expect(wrapper.vm.commentaireDraft).toBe('A contacter avant le depart')
  })

  it('INT-EQUIPE-COMMENTAIRE-002 sauvegarde le commentaire uniquement a la perte du focus', async () => {
    const equipes = { 1: createEquipe({ equipe: 1, commentaire: '' }) }
    const wrapper = mountEquipe('1', { equipes, equipiers, course: { status: 'COURSE' } })

    wrapper.vm.commentaireDraft = 'Nouveau commentaire'
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/equipe/1'), expect.anything())

    await wrapper.vm.saveCommentaire()

    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/equipe/1', {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentaire: 'Nouveau commentaire' }),
    })
  })

  it('INT-EQUIPE-TELEPHONE-001 affiche le telephone quand il est present', () => {
    const equipes = { 1: createEquipe({ equipe: 1, telephone: '0600000000' }) }
    const wrapper = mountEquipe('1', { equipes, equipiers, course: { status: 'COURSE' } }, { fullMount: true })

    expect(wrapper.text()).toContain('Téléphone')
    expect(wrapper.text()).toContain('0600000000')
  })

  it('INT-EQUIPE-TELEPHONE-002 n\'affiche ni le champ ni le libelle telephone quand il est absent', () => {
    const equipes = { 1: createEquipe({ equipe: 1 }) }
    delete equipes[1].telephone
    const wrapper = mountEquipe('1', { equipes, equipiers, course: { status: 'COURSE' } }, { fullMount: true })

    expect(wrapper.text()).not.toContain('Téléphone')
  })

  it('INT-EQUIPE-NON-PARTANTE-003 expose le bouton de statut non partant dans la fiche equipe', () => {
    const equipes = { 1: createEquipe({ equipe: 1 }) }
    const wrapper = mountEquipe('1', { equipes, equipiers, course: { status: 'COURSE' } })

    expect(wrapper.findComponent(EquipeNonPartante).exists()).toBe(true)
  })
})
