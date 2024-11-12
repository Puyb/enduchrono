<template>
  <span>
    {{ equipier.transpondeurs.filter(transpondeur => !transpondeur.deleted).map(v => v.id).join(', ') }}
    <b-button v-b-modal="id" variant="outline-primary" size="sm"><b-icon-pencil></b-icon-pencil></b-button>
    <b-modal :id="id" :title="title" @ok="onSubmit">
      <b-table-simple>
        <b-tr>
          <b-th>Transpondeurs</b-th>
          <b-th>Tours</b-th>
          <b-th>Timestamp</b-th>
          <b-th></b-th>
        </b-tr>
        <b-tr v-for="transpondeur in newTranspondeurs" :key="transpondeur.id">
          <b-td>{{ transpondeur.id }}</b-td>
          <b-td>{{ tours(transpondeur).length }}</b-td>
          <b-td>{{ lastSeen(transpondeur) }}</b-td>
          <b-td><b-button :variant="transpondeur.deleted ? 'success' : 'danger'" @click="remove(transpondeur)"><b-icon-power /></b-button></b-td>
        </b-tr>
        <b-tr>
          <b-td><b-input placeholder="ID transpondeur" v-model="newTranspondeur" /></b-td>
          <b-td></b-td>
          <b-td></b-td>
          <b-td><b-button variant="success" @click="add()"><b-icon-plus /></b-button></b-td>
        </b-tr>
      </b-table-simple>
    </b-modal>
  </span>
</template>

<script>
import { formatTime } from '../utils'
export default {
  name: 'EquipierTranspondeurs',
  components: {
  },
  props: {
    equipier: null,
  },
  data() {
    return {
      newTranspondeur: '',
      newTranspondeurs: [...this.equipier.transpondeurs],
    }
  },
  computed: {
    id() { return `modal-equipier-transpondeur-${this.equipier.dossard}` },
    title() { return `${this.equipier.dossard} ${this.equipier.nom} ${this.equipier.prenom}` },
  },
  methods: {
    tours(transpondeur) {
      return this.$store.state.tours.filter(tour => tour.transpondeur === transpondeur.id)
    },
    lastSeen(transpondeur) {
      return formatTime(this.tours(transpondeur).slice(-1)[0]?.timestamp)
    },
    remove({ id }) {
      const transpondeur = this.newTranspondeurs.find(trans => trans.id === id)
      transpondeur.deleted = !transpondeur.deleted
    },
    add() {
      if (!this.newTranspondeur) return
      this.newTranspondeurs.push({ id: this.newTranspondeur, dossard: this.equipier.dossard, deleted: false })
      this.newTranspondeur = ''
    },
    async onSubmit() {
    },
  },
}
</script>
