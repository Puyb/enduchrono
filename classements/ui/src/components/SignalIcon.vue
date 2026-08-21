<template>
  <span :class="{ 'transpondeur-icon': clickable }" @click.stop="onClick">
    <BIconDashCircle v-if="value == null" variant="secondary" title="Jamais vu" />
    <BIconReception4 v-else-if="value >= 90" :variant="variant" :title="title" />
    <BIconReception3 v-else-if="value >= 80" :variant="variant" :title="title" />
    <BIconReception2 v-else-if="value >= 70" :variant="variant" :title="title" />
    <BIconReception1 v-else-if="value >= 40" :variant="variant" :title="title" />
    <BIconReception0 v-else :variant="variant" :title="title" />
  </span>
</template>

<script>
export default {
  name: 'SignalIcon',
  props: {
    value: { default: null },
    transpondeurId: { default: null },
  },
  computed: {
    // Seuils convenus : >=90 bon, >=70 moyen, <70 faible (rouge)
    variant() { return this.value < 70 ? 'danger' : null },
    title() { return `Signal ${this.value}` },
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
