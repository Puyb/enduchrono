const { shallowMount, mount } = require('@vue/test-utils')
jest.mock('../../src/components/EquipierChart.vue', () => ({ name: 'EquipierChart', render: h => h('div') }))
const Equipe = require('../../src/components/Equipe.vue').default
const LogsTable = require('../../src/components/LogsTable.vue').default
const { createEquipe, createEquipier, createStoreState } = require('./helpers/factories')

function mountEquipe(numero, state, { fullMount = false } = {}) {
  const mountFn = fullMount ? mount : shallowMount
  const storeState = createStoreState(state)
  const wrapper = mountFn(Equipe, {
    propsData: { numero },
    mocks: { $store: { state: storeState } },
  })
  wrapper.vm.$root.URL = storeState.URL
  return wrapper
}

describe('Equipe - onglet Actions (journal des logs)', () => {
  const equipes = { 1: createEquipe({ equipe: 1 }) }
  const equipiers = {
    11: createEquipier({ dossard: 11, nom: 'Nom11', prenom: 'Prenom11', transpondeurs: [] }),
  }
  const teamLogs = [
    { id: 1, timestamp: 1700000000000, elapsed: 1000, action: "Ajout d'un tour", object_type: 'tour', object_id: '1', equipe: 1, data: { dossard: 11 } },
    { id: 2, timestamp: 1700000001000, elapsed: 2000, action: "Modification d'une équipe", object_type: 'equipe', object_id: '1', equipe: 1, data: { commentaire: 'ok' } },
  ]

  function fetchMock(url) {
    if (String(url).includes('/tours')) return Promise.resolve({ json: async () => ({ tours: [], hasMore: false }) })
    if (String(url).includes('/logs')) return Promise.resolve({ json: async () => ({ logs: teamLogs }) })
    return Promise.resolve({ json: async () => ({}) })
  }

  beforeEach(() => {
    global.fetch = jest.fn(fetchMock)
  })

  it('INT-EQUIPE-LOGS-001 charge les actions de l\'equipe via GET /logs?equipe=... au montage', async () => {
    const wrapper = mountEquipe('1', { equipes, equipiers, course: { status: 'COURSE' } })
    await wrapper.vm.fetchTeamLogs()

    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/logs?equipe=1')
    expect(wrapper.vm.teamLogs).toEqual(teamLogs)
  })

  it('INT-EQUIPE-LOGS-002 le badge de l\'onglet Actions reflete le nombre de logs charges', async () => {
    const wrapper = mountEquipe('1', { equipes, equipiers, course: { status: 'COURSE' } }, { fullMount: true })
    wrapper.vm.teamLogs = teamLogs
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Actions')
    expect(wrapper.text()).toContain('2')
  })

  it('INT-EQUIPE-LOGS-003 transmet les logs de l\'equipe au tableau LogsTable', async () => {
    const wrapper = mountEquipe('1', { equipes, equipiers, course: { status: 'COURSE' } })
    wrapper.vm.teamLogs = teamLogs
    await wrapper.vm.$nextTick()

    const table = wrapper.findComponent(LogsTable)
    expect(table.exists()).toBe(true)
    expect(table.props('logs')).toEqual(teamLogs)
  })

  it('INT-EQUIPE-LOGS-004 la sauvegarde du commentaire rafraichit le journal des actions', async () => {
    const wrapper = mountEquipe('1', { equipes, equipiers, course: { status: 'COURSE' } })
    global.fetch.mockClear()

    await wrapper.vm.saveCommentaire()

    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/equipe/1', expect.anything())
    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/logs?equipe=1')
  })
})
