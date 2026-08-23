const { mount } = require('@vue/test-utils')
const Logs = require('../../src/components/Logs.vue').default
const { createStoreState } = require('./helpers/factories')

function mountLogs(state = {}) {
  const storeState = createStoreState(state)
  const wrapper = mount(Logs, {
    mocks: { $store: { state: storeState } },
  })
  wrapper.vm.$root.URL = storeState.URL
  return wrapper
}

describe('Logs integration', () => {
  const sampleLogs = [
    {
      id: 2,
      timestamp: 1700000002000,
      elapsed: 5000,
      action: "Modification d'une équipe",
      object_type: 'equipe',
      object_id: '1',
      equipe: 1,
      data: { commentaire: 'ok' },
    },
    {
      id: 1,
      timestamp: 1700000001000,
      elapsed: null,
      action: "Ajout/modification d'un transpondeur",
      object_type: 'transpondeur',
      object_id: 'TP-1',
      equipe: null,
      data: { id: 'TP-1', dossard: null },
    },
  ]

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ logs: sampleLogs }) })
  })

  it('INT-LOGS-001 charge et affiche toutes les actions au montage', async () => {
    const wrapper = mountLogs()
    await wrapper.vm.$nextTick()
    await wrapper.vm.fetchLogs()

    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/logs')
    expect(wrapper.vm.logs).toEqual(sampleLogs)
    expect(wrapper.text()).toContain("Modification d'une équipe")
    expect(wrapper.text()).toContain("Ajout/modification d'un transpondeur")
  })

  it('INT-LOGS-002 le bouton Rafraichir relance le chargement', async () => {
    const wrapper = mountLogs()
    await wrapper.vm.fetchLogs()
    global.fetch.mockClear()

    await wrapper.find('button').trigger('click')

    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/logs')
  })

  it("INT-LOGS-003 n'affiche pas de lien equipe quand l'action n'est rattachee a aucune equipe", async () => {
    const wrapper = mountLogs()
    await wrapper.vm.fetchLogs()

    const rows = wrapper.findAll('tbody tr')
    expect(rows.at(1).text()).not.toContain('undefined')
  })
})
