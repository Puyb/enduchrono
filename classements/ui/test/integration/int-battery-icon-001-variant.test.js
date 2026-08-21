const { shallowMount } = require('@vue/test-utils')
const BatteryIcon = require('../../src/components/BatteryIcon.vue').default

describe('BatteryIcon integration', () => {
  it('INT-BATTERY-ICON-001 variant rouge uniquement pour une batterie <= 1', () => {
    expect(shallowMount(BatteryIcon, { propsData: { value: 3 } }).vm.variant).toBe(null)
    expect(shallowMount(BatteryIcon, { propsData: { value: 2 } }).vm.variant).toBe(null)
    expect(shallowMount(BatteryIcon, { propsData: { value: 1 } }).vm.variant).toBe('danger')
    expect(shallowMount(BatteryIcon, { propsData: { value: 0 } }).vm.variant).toBe('danger')
  })

  it('INT-BATTERY-ICON-002 clic avec transpondeurId : emet click avec cet id (pour ouvrir le popup)', () => {
    const wrapper = shallowMount(BatteryIcon, { propsData: { value: 3, transpondeurId: 'TP-11' } })
    wrapper.trigger('click')
    expect(wrapper.emitted('click')).toEqual([['TP-11']])
  })

  it("INT-BATTERY-ICON-003 sans transpondeurId, le clic n'emet rien", () => {
    const wrapper = shallowMount(BatteryIcon, { propsData: { value: 3 } })
    wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('INT-BATTERY-ICON-004 value null (jamais vu) : pas clickable si transpondeurId absent', () => {
    const wrapper = shallowMount(BatteryIcon, { propsData: { value: null } })
    expect(wrapper.vm.clickable).toBe(false)
  })
})
