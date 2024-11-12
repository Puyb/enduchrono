<template>
  <span>
      <b-button v-b-modal.modal-penalite variant="outline-danger" size="sm">{{ equipe.penalite ? `${equipe.tours}${equipe.penalite}` : '' }} <BIconFlagFill></BIconFlagFill></b-button>
  <b-modal id="modal-penalite" :title="title" @ok="onSubmit">
    <b-form @submit="onSubmit">
      <b-form-group
        id="input-group-penalite"
        label="Penalité (-) /  Bonus (+):"
        label-for="input-penalite"
        description="Nombre de tour a jouter (+) retirer (-)"
      >
        <b-form-input
          id="input-penalite"
          v-model="newPenalite"
          type="number"
          required
        ></b-form-input>
      </b-form-group>
    </b-form>
    <b-table-simple>
      <b-tr>
        <b-th>Tours</b-th>
        <b-td>{{ equipe.tours + equipe.penalite }}</b-td>
        <b-td><BIconArrowRightShort></BIconArrowRightShort></b-td>
        <b-td>{{ equipe.tours + parseInt(newPenalite) }}</b-td>
      </b-tr>
      <b-tr>
        <b-th>Position générale</b-th>
        <b-td>{{ equipe.position_general }}</b-td>
        <b-td><BIconArrowRightShort></BIconArrowRightShort></b-td>
        <b-td>{{ newPositionGeneral }}</b-td>
      </b-tr>
      <b-tr>
        <b-th>Position catégorie {{ equipe.categorie }}</b-th>
        <b-td>{{ equipe.position_categorie }}</b-td>
        <b-td><BIconArrowRightShort></BIconArrowRightShort></b-td>
        <b-td>{{ newPositionCategorie }}</b-td>
      </b-tr>
    </b-table-simple>
  </b-modal>
  </span>
</template>

<script>
//import { formatTime, formatDuree } from '../utils'
import { rankValue } from '../utils'
export default {
  name: 'Tours',
  components: { },
  props: {
    equipe: null,
  },
  data() {
    return {
        newPenalite: this.equipe.penalite,
    }
  },
  computed: {
    title() {
      return `Penalité - Equipe ${ this.equipe.equipe } - ${ this.equipe.nom }`
    },
    newPositionGeneral() {
      const penalite = parseInt(this.newPenalite)
      const equipes = Object.values(this.$store.state.equipes)
        .map(equipe => rankValue({...equipe, penalite: equipe === this.equipe ? penalite : equipe.penalite }))
      equipes.sort((a, b) => a - b)
      const newRank = rankValue({ ...this.equipe, penalite })
      return equipes.indexOf(newRank) + 1
    },
    newPositionCategorie() {
      const penalite = parseInt(this.newPenalite)
      const equipes = Object.values(this.$store.state.equipes)
        .filter(equipe => equipe.categorie === this.equipe.categorie)
        .map(equipe => rankValue({...equipe, penalite: equipe === this.equipe ? penalite : equipe.penalite }))
      equipes.sort((a, b) => a - b)
      const newRank = rankValue({ ...this.equipe, penalite })
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
        body: JSON.stringify({ penalite: parseInt(this.newPenalite) }),
      })
    }
  }
}
</script>

<style>
</style>
