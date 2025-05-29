<template>
  <span>
  <b-button v-b-modal.modal-categorie variant="outline-primary" size="sm"><b-icon-pencil></b-icon-pencil></b-button>
  <b-modal id="modal-categorie" :title="title" @ok="onSubmit">
    <b-form @submit="onSubmit">
      <b-form-group
        id="input-group-categorie"
        label="Nouvelle catégorie"
        label-for="input-categorie"
        description=""
      >
        <b-form-select
          id="input-categorie"
          v-model="newCategorie"
          :options="categories"
          required
        ></b-form-select>
      </b-form-group>
    </b-form>
    <b-table-simple>
      <b-tr>
        <b-th></b-th>
        <b-th>{{ equipe.categorie }}</b-th>
        <b-th><BIconArrowRightShort></BIconArrowRightShort></b-th>
        <b-th>{{ newCategorie }}</b-th>
      </b-tr>
      <b-tr>
        <b-th>Position catégorie</b-th>
        <b-td>{{ equipe.position_categorie }}</b-td>
        <b-td><BIconArrowRightShort></BIconArrowRightShort></b-td>
        <b-td>{{ newPositionCategorie }}</b-td>
      </b-tr>
    </b-table-simple>
  </b-modal>
  </span>
</template>

<script>
import { rankValue } from '../utils'
export default {
  name: 'Tours',
  components: { },
  props: {
    equipe: null,
  },
  data() {
    return {
        newCategorie: this.equipe.categorie,
    }
  },
  computed: {
    title() {
      return `Catégorie - Equipe ${ this.equipe.equipe } - ${ this.equipe.nom }`
    },
    categories() { return this.$store.state.categories?.map(value => ({ value, text: value })); },
    newPositionCategorie() {
      const equipes = Object.values(this.$store.state.equipes)
        .filter(equipe => equipe.categorie === this.newCategorie)
        .map(rankValue)
      const newRank = rankValue(this.equipe)
      equipes.push(newRank)
      equipes.sort((a, b) => a - b)
      return equipes.indexOf(newRank) + 1
    },
  },
  methods: {
    async onSubmit() {
      await fetch(`${this.$root.URL}/equipe/${this.equipe.equipe}`, {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ categorie: this.newCategorie }),
      })
    }
  }
}
</script>

<style>
</style>
