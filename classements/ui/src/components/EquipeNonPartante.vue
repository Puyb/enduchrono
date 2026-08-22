<template>
  <b-button :variant="equipe.non_partante ? 'secondary' : 'outline-secondary'" size="sm" @click="toggle">
    <BIconPersonXFill></BIconPersonXFill> {{ equipe.non_partante ? 'Non partante' : 'Définir non partante' }}
  </b-button>
</template>

<script>
export default {
  name: 'EquipeNonPartante',
  props: {
    equipe: null,
  },
  methods: {
    async toggle() {
      await fetch(`${this.$root.URL}/equipe/${this.equipe.equipe}`, {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ non_partante: !this.equipe.non_partante }),
      })
    }
  }
}
</script>

<style>
</style>
