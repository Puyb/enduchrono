const { shallowMount } = require('@vue/test-utils')
const SignalIcon = require('../../src/components/SignalIcon.vue').default

describe('SignalIcon integration', () => {
  it('INT-SIGNAL-ICON-001 variant rouge uniquement en dessous du seuil de 70 (faible)', () => {
    expect(shallowMount(SignalIcon, { propsData: { value: 90 } }).vm.variant).toBe(null)
    expect(shallowMount(SignalIcon, { propsData: { value: 70 } }).vm.variant).toBe(null)
    expect(shallowMount(SignalIcon, { propsData: { value: 69 } }).vm.variant).toBe('danger')
    expect(shallowMount(SignalIcon, { propsData: { value: 0 } }).vm.variant).toBe('danger')
  })

  it('INT-SIGNAL-ICON-002 clic avec transpondeurId : emet click avec cet id', () => {
    const wrapper = shallowMount(SignalIcon, { propsData: { value: 95, transpondeurId: 'TP-11' } })
    wrapper.trigger('click')
    expect(wrapper.emitted('click')).toEqual([['TP-11']])
  })
})
