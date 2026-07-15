const { shallowMount } = require('@vue/test-utils')
const EquipierTranspondeurs = require('../../src/components/EquipierTranspondeurs.vue').default
const { createEquipier, createTranspondeur, createStoreState, stubBvModal } = require('./helpers/factories')

function mountComponent(equipier, extraState = {}) {
  const state = createStoreState(extraState)
  const wrapper = shallowMount(EquipierTranspondeurs, {
    propsData: { equipier },
    mocks: { $store: { state } },
  })
  wrapper.vm.$root.URL = state.URL
  return wrapper
}

describe('EquipierTranspondeurs integration', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({})
  })

  it('INT-TRANSPONDEURS-009 ajoute un transpondeur libre sans demander de confirmation', async () => {
    const equipier = createEquipier({ dossard: 11, transpondeurs: [] })
    const wrapper = mountComponent(equipier, {
      transpondeurs: [createTranspondeur({ id: 'TRP-FREE', dossard: null })],
    })
    const bvModal = stubBvModal(wrapper.vm, true)
    wrapper.vm.newTranspondeur = 'TRP-FREE'

    await wrapper.vm.add()

    expect(bvModal.msgBoxConfirm).not.toHaveBeenCalled()
    expect(wrapper.vm.newTranspondeurs.map(t => t.id)).toContain('TRP-FREE')
    expect(wrapper.vm.newTranspondeurs.find(t => t.id === 'TRP-FREE').dossard).toBe(11)
    expect(wrapper.vm.newTranspondeur).toBe('')
  })

  it('INT-TRANSPONDEURS-010 ajoute un transpondeur inconnu (nouvel id) sans confirmation', async () => {
    const equipier = createEquipier({ dossard: 11, transpondeurs: [] })
    const wrapper = mountComponent(equipier, { transpondeurs: [] })
    wrapper.vm.newTranspondeur = 'TRP-NEW'

    await wrapper.vm.add()

    expect(wrapper.vm.newTranspondeurs.map(t => t.id)).toEqual(['TRP-NEW'])
    expect(wrapper.vm.newTranspondeurs[0].dossard).toBe(11)
    expect(wrapper.vm.newTranspondeurs[0].changed).toBe(true)
  })

  it('INT-TRANSPONDEURS-011 demande confirmation en cas de conflit et reassigne si confirme', async () => {
    const equipier = createEquipier({ dossard: 11, transpondeurs: [] })
    const wrapper = mountComponent(equipier, {
      transpondeurs: [createTranspondeur({ id: 'TRP-BUSY', dossard: 21 })],
      equipiers: { 21: createEquipier({ dossard: 21, nom: 'Nom21', prenom: 'Prenom21' }) },
    })
    const bvModal = stubBvModal(wrapper.vm, true)
    wrapper.vm.newTranspondeur = 'TRP-BUSY'

    await wrapper.vm.add()

    expect(bvModal.msgBoxConfirm).toHaveBeenCalledWith(
      expect.stringContaining('Nom21'),
      expect.objectContaining({ okTitle: 'Remplacer' })
    )
    const reassigned = wrapper.vm.newTranspondeurs.find(t => t.id === 'TRP-BUSY')
    expect(reassigned.dossard).toBe(11)
    expect(reassigned.changed).toBe(true)
  })

  it('INT-TRANSPONDEURS-012 n\'affecte pas le transpondeur si la confirmation du conflit est annulee', async () => {
    const equipier = createEquipier({ dossard: 11, transpondeurs: [] })
    const wrapper = mountComponent(equipier, {
      transpondeurs: [createTranspondeur({ id: 'TRP-BUSY', dossard: 21 })],
      equipiers: { 21: createEquipier({ dossard: 21, nom: 'Nom21', prenom: 'Prenom21' }) },
    })
    stubBvModal(wrapper.vm, false)
    wrapper.vm.newTranspondeur = 'TRP-BUSY'

    await wrapper.vm.add()

    expect(wrapper.vm.newTranspondeurs.map(t => t.id)).not.toContain('TRP-BUSY')
    expect(wrapper.vm.newTranspondeur).toBe('')
  })

  it('INT-TRANSPONDEURS-013 remove bascule le statut deleted et marque le transpondeur modifie', () => {
    const equipier = createEquipier({ dossard: 11, transpondeurs: [createTranspondeur({ id: 'TRP-11', dossard: 11, deleted: false })] })
    const wrapper = mountComponent(equipier)

    wrapper.vm.remove({ id: 'TRP-11' })

    const updated = wrapper.vm.newTranspondeurs.find(t => t.id === 'TRP-11')
    expect(updated.deleted).toBe(true)
    expect(updated.changed).toBe(true)
  })

  it('INT-TRANSPONDEURS-014 onSubmit n\'envoie que les transpondeurs modifies avec le bon payload', async () => {
    const equipier = createEquipier({
      dossard: 11,
      transpondeurs: [
        createTranspondeur({ id: 'TRP-11', dossard: 11, deleted: false }),
        createTranspondeur({ id: 'TRP-11B', dossard: 11, deleted: false }),
      ],
    })
    const wrapper = mountComponent(equipier)
    wrapper.vm.remove({ id: 'TRP-11' })

    await wrapper.vm.onSubmit()

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith('http://classements.test/transpondeur', {
      method: 'post',
      body: JSON.stringify({ id: 'TRP-11', dossard: 11, deleted: true }),
    })
  })
})
