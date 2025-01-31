<template>
  <div class="d-flex flex-column" style="height: 100vh; max-height: 100vh;">
    <b-navbar toggleable="lg" type="dark" variant="info" class="sticky-top">
      <b-navbar-brand href="#">Chronelec simulator</b-navbar-brand>

      <b-navbar-toggle target="nav-collapse"></b-navbar-toggle>

      <b-collapse id="nav-collapse" is-nav>
        <b-navbar-nav class="ml-auto">
          <b-form-checkbox size="lg" v-model="connected" @change="connect()">Connecté</b-form-checkbox>
          <b-nav-text>Temps: {{ $store.state.timeString }}</b-nav-text>
          <b-form-select v-model="speed" :options="speedOptions" @change="setMultiplier(speed)"></b-form-select>
        </b-navbar-nav>
      </b-collapse>
    </b-navbar>
    <div class="d-flex flex-column flex-fill" style="overflow: scroll">
      <b-row>
        <b-col>
          <b-button v-for="transpondeur of transpondeurs" :key="transpondeur.id" @click="tour(transpondeur)">{{ transpondeur }}</b-button>
          <b-button @click="addTranspondeur()">Ajouter</b-button>
        </b-col>
        <b-col>
          <dl>
            <dd>Tours envoyées :</dd><dt>{{ $store.state.sent }}</dt>
            <dd>Tours en attente :</dd><dt>{{ $store.state.pending }}</dt>
            <dd>Tours futures :</dd><dt>{{ $store.state.futur }}</dt>
          </dl>
        </b-col>
        <b-col>
          <b-form>
            <b-form-group
              label="Liste de tours a envoyer:"
              label-for="input-file"
              description="We'll never share your email with anyone else."
            >
              <b-form-file
                id="input-file"
                drop-placeholder="Drop file here..."
                @input="sendFile"
              ></b-form-file>
            </b-form-group>
          </b-form>
        </b-col>
      </b-row>
    </div>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      speed: 1,
      speedOptions: [0, 1, 2, 4, 8, 16, 32].map(value => ({ value, text: value ? `${value}x` :  'Pause' })),
      transpondeurs: ['115234', '115327', '115330'],
      connected: true,
    }
  },
  computed: {
  },
  methods: {
    async tour(transpondeur) {
      await fetch(`${this.$store.state.URL}/tours/add`, { method: 'POST', body: JSON.stringify({ transpondeur }), headers: { 'content-type': 'application/json' } })
    },
    async setMultiplier(multiplier) {
      await fetch(`${this.$store.state.URL}/time/multiplier`, { method: 'POST', body: JSON.stringify({ multiplier }), headers: { 'content-type': 'application/json' } })
    },
    addTranspondeur() {
      const id = prompt('Id du nouveau transpondeur')
      if (id) this.transpondeurs.push(id)
    },
    async sendFile(file) { 
      console.log('sendFile', file)
      await fetch(`${this.$store.state.URL}/tours/add`, { method: 'POST', body: file, headers: { 'content-type': 'text/plain' } })
    },
    async connect() {
      if (this.connected) {
        await fetch(`${this.$store.state.URL}/connect`, { method: 'POST' })
      } else {
        await fetch(`${this.$store.state.URL}/disconnect`, { method: 'POST' })
      }
    }

  },
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
