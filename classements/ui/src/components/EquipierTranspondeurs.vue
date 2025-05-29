<template>
  <span>
    {{ equipier.transpondeurs.filter(transpondeur => !transpondeur.deleted).map(v => v.id).join(', ') }}
    <b-button v-b-modal="id" variant="outline-primary" size="sm"><b-icon-pencil></b-icon-pencil></b-button>
    <b-modal :id="id" :title="title" @ok="onSubmit" @show="onShow">
      <b-table-simple>
        <b-tr>
          <b-th>Transpondeurs</b-th>
          <b-th>Tours</b-th>
          <b-th>Timestamp</b-th>
          <b-th></b-th>
        </b-tr>
        <b-tr v-for="transpondeur in newTranspondeurs" :key="transpondeur.id">
          <b-td :class="transpondeur.deleted ? 'deleted' : ''">{{ transpondeur.id }}</b-td>
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
import * as _ from 'lodash'
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
    onShow() {
      this.newTranspondeurs = _.cloneDeep(this.equipier.transpondeurs)
    },
    tours(transpondeur) {
      return this.$store.state.tours.filter(tour => tour.transpondeur === transpondeur.id)
    },
    lastSeen(transpondeur) {
      return formatTime(this.tours(transpondeur).slice(-1)[0]?.timestamp)
    },
    remove({ id }) {
      const transpondeur = this.newTranspondeurs.find(trans => trans.id === id)
      transpondeur.deleted = !transpondeur.deleted
      transpondeur.changed = true
    },
    async add() {
      if (!this.newTranspondeur) return
      const exist = _.find(this.$store.state.transpondeurs, t => t === this.newTranspondeur)
      if (exist?.dossard) {
        const equipier = this.$store.state.equipiers[exist.dossard]
        if (!await this.$bvModal.msgBoxConfirm(`Ce transpondeur est déjà utilisé par ${equipier.dossard} ${equipier.nom} ${equipier.prenom}`, {
          title: 'Ajout de transpondeur',
          okVariant: 'danger',
          okTitle: 'Remplacer',
          cancelTitle: 'Annuler',
        })) {
          this.newTranspondeur = ''
          return
        }
      }
      const transpondeur =  exist || { id: this.newTranspondeur, dossard: this.equipier.dossard, deleted: false }
      transpondeur.changed = true
      console.log('push', transpondeur)
      this.newTranspondeurs.push(transpondeur)
      this.newTranspondeur = ''
    },
    async onSubmit() {
      await Promise.all(this.newTranspondeurs.map(async t => {
        console.log('t', t, t.changed)
        if (t.changed) {
          await fetch(`${this.$root.URL}/transpondeur`, {
            method: 'post',
            body: JSON.stringify(_.pick(t, ['id', 'dossard', 'deleted'])),
          })
        }
      }))
    },
  },
}
</script>
<style scoped>
.deleted { text-decoration: strike-through; }
</stype>
