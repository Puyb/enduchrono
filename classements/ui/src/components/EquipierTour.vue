<template>
  <span>
    <b-button @click="open()" variant="outline-primary" size="sm"><b-icon-plus></b-icon-plus></b-button>
    <b-modal :id="id" :title="title" @ok="onSubmit" size="lg">
      <b-input-group class="mb-2">
        <b-input-group-prepend is-text>
          <b-icon-stopwatch />
        </b-input-group-prepend>
        <b-form-input type="time" step="0.001" v-model="newPassageStr"></b-form-input>
      </b-input-group>
      <ToursTable :tours="newTours" :fields="toursFields" :tbody-tr-class="rowClass" />
      <b-table-simple>
        <b-tr>
          <b-th>Tours</b-th>
          <b-th>{{ tours.length }}</b-th>
          <b-th><BIconArrowRightShort></BIconArrowRightShort></b-th>
          <b-th>{{ newNbTours }}</b-th>
        </b-tr>
        <b-tr>
          <b-th>Position général</b-th>
          <b-td>{{ equipe.position_general }}</b-td>
          <b-td><BIconArrowRightShort></BIconArrowRightShort></b-td>
          <b-td>{{ newPositionGeneral }}</b-td>
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
import { formatTime, parseTime, rankValue } from '../utils'
import ToursTable from './ToursTable.vue'
import { BIconStopwatch, BIconArrowRightShort } from 'bootstrap-vue'
export default {
  name: 'EquipierTour',
  components: {
    ToursTable,
    BIconStopwatch,
    BIconArrowRightShort,
  },
  props: {
    equipier: null,
  },
  data() {
    return {
      newPassageStr: '0:00:00.000',
      toursFields: [
        { key: 'transpondeur' },
        { key: 'dossard' },
        { key: 'nom' },
        { key: 'prenom' },
        { key: 'timestamp' },
        { key: 'duree' },
      ],
      equipierColors: ['primary', 'danger', 'success', 'warning', 'info'],
    }
  },
  computed: {
    id() { return `modal-equipier-tour-${this.equipier.dossard}` },
    title() { return `${this.equipier.dossard} ${this.equipier.nom} ${this.equipier.prenom}` },
    newPassage() {
      return parseTime(this.newPassageStr)
    },
    newPassageStr2() {
      return formatTime(this.newPassage)
    },
    numero() { return String(this.equipier.dossard).slice(0, -1) },
    equipe() {
      return this.$store.state.equipes[this.numero]
    },
    tours() {
      const tours = this.$store.state.tours
        .filter(tour => String(tour.dossard).slice(0, -1) === this.numero)
      if (this.$store.state.course.status === 'TEST') {
        return tours.filter(t => t.status === 'ignore')
      } else {
        return tours.filter(t => !t.status)
      }
    },
    newTours() {
      const tours = [...this.tours].reverse()
      let pos = tours.findIndex(tr => tr.timestamp > this.newPassage)
      const newTours = []
      let previousTime = 0
      if (pos < 0) pos = tours.length
      if (pos > 0) {
        previousTime = tours[pos - 1].timestamp
        newTours.push(tours[pos - 1])
      }
      newTours.push({
        dossard: this.equipier.dossard,
        timestamp: this.newPassage,
        duree: this.newPassage - previousTime,
        source: 'Manuel',
      })
      if (pos < this.tours.length) {
        newTours.push({
          ...tours[pos],
          newDuree: tours[pos].timestamp - this.newPassage,
        })
      }
      return newTours
    },
    newPositionGeneral() {
      return this.newPosition()
    },
    newPositionCategorie() {
      return this.newPosition(this.equipe.categorie)
    },
    newNbTours() { return this.tours.length + 1 }
  },
  methods: {
    rowClass(item, type) {
      if (!item || type !== 'row') return
      const classes = []
      if (item.status === 'deleted') classes.push('text-decoration-line-through-red')
      if (item.status === 'duplicate') classes.push('text-decoration-line-through-blue')
      classes.push(`table-${this.equipierColors[String(item.dossard).slice(-1)]}`)
      return classes
    },
    newPosition(categorie) {
      const equipes = Object.values(this.$store.state.equipes)
        .filter(equipe => (!categorie || equipe.categorie === categorie) && equipe != this.equipe)
        .map(rankValue)
      const newRank = rankValue({ ...this.equipe, tours: this.equipe.tours + 1, temps: Math.max(this.equipe.temps, this.newPassage) })
      equipes.push(newRank)
      equipes.sort((a, b) => a - b)
      return equipes.indexOf(newRank) + 1
    },
    async open() {
      this.newPassageStr = formatTime(this.$store.state.time)
      await this.$bvModal.show(this.id)
    },
    async onSubmit() {
      await fetch(`${this.$root.URL}/tour`, {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dossard: this.equipier.dossard, timestamp: this.newPassage, source: 'manuel' }),
      })
    }
  },
}
</script>
