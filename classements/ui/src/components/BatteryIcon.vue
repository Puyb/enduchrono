<template>
  <span :class="{ 'transpondeur-icon': clickable }" @click.stop="onClick">
    <BIconDashCircle v-if="value == null" variant="secondary" title="Jamais vu" />
    <BIconBatteryFull v-else-if="value >= 3" :variant="variant" :title="title" />
    <BIconBatteryHalf v-else-if="value === 2" :variant="variant" :title="title" />
    <BIconBattery v-else :variant="variant" :title="title" />
  </span>
</template>

<script>
export default {
  name: 'BatteryIcon',
  props: {
    value: { default: null },
    transpondeurId: { default: null },
  },
  computed: {
    variant() { return this.value <= 1 ? 'danger' : null },
    title() { return `Batterie ${this.value}/3` },
    clickable() { return this.transpondeurId != null },
  },
  methods: {
    onClick() {
      if (this.clickable) this.$emit('click', this.transpondeurId)
    },
  },
}
</script>

<style scoped>
.transpondeur-icon { cursor: pointer; }
</style>
