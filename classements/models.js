'use strict'
const _ = require('lodash')

const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: './data.db'
  }
})

const initDb = async () => {
  if (!await knex.schema.hasTable('equipes')) {
    await knex.schema.createTable('equipes', (table) => {
      table.integer('equipe')
      table.string('nom')
      table.string('categorie')
      table.string('gerant_nom')
      table.string('gerant_prenom')
      table.string('gerant_ville')
      table.string('gerant_code_postal')
      table.string('gerant_code_pays')
      table.unique(['equipe'])
    })
    await knex.schema.createTable('equipiers', (table) => {
      table.integer('equipe')
      table.integer('dossard')
      table.string('nom')
      table.string('prenom')
      table.string('sexe')
      table.string('date_de_naissance')
      table.string('num_licence')
      table.foreign('equipe').references('equipe').inTable('equipes')
      table.index(['equipe'])
      table.unique(['dossard'])
    })
    await knex.schema.createTable('transpondeurs', (table) => {
      table.integer('dossard')
      table.string('id')
      table.foreign('dossard').references('dossard').inTable('equipiers')
      table.index(['dossard'])
      table.unique(['id'])
    })
    await knex.schema.createTable('tours', (table) => {
      table.integer('id')
      table.string('transpondeur')
      table.integer('dossard').nullable()
      table.integer('timestamp')
      table.string('source')
      table.boolean('duplicate')
      table.unique(['id'])
      table.foreign('dossard').references('dossard').inTable('equipiers')
      table.index(['dossard'])
    })
  }
}

const tours = []
const transpondeurs = {}
const equipes = {}
const equipiers = {}
const categories = { general: [] }

const clear = object => { for (const key of Object.keys(object)) delete object[key] }

const reset = async () => {
  tours.length = 0
  clear(transpondeurs)
  clear(equipes)
  clear(equipiers)
  clear(categories)
  categories.general = []
  await knex('transpondeurs').delete()
  await knex('tours').delete()
  await knex('equipiers').delete()
  await knex('equipes').delete()
}

const load = async () => {
  const equipeRows = await knex.select('*').from('equipes')
  for (const equipeRow of equipeRows) {
    const equipe = {
      ...equipeRow,
      _has_changed: false,
      get position_general () { return this._position_general },
      set position_general (value) {
        if (this._position_general !== value) {
          this._has_changed = true
        }
        Object.defineProperty(this, '_position_general', {
          value,
          enumerable: false,
          writable: true
        })
      },
      get position_categorie () { return this._position_categorie },
      set position_categorie (value) {
        if (this._position_categorie !== value) {
          this._has_changed = true
        }
        Object.defineProperty(this, '_position_categorie', {
          value,
          enumerable: false,
          writable: true
        })
      },
      tours: [],
      duplicate: []
    }
    equipes[equipe.equipe] = equipe
    categories.general.push(equipe)
    categories[equipe.categorie] = categories[equipe.categorie] || []
    categories[equipe.categorie].push(equipe)
  }
  const equipierRows = await knex.select('*').from('equipiers')
  for (const equipierRow of equipierRows) {
    equipiers[equipierRow.dossard] = { ...equipierRow, transpondeurs: [] }
  }
  const transpondeurRows = await knex.select('*').from('transpondeurs')
  for (const transpondeurRow of transpondeurRows) {
    transpondeurs[transpondeurRow.id] = transpondeurRow
    equipiers[transpondeurRow.dossard].transpondeurs.push(transpondeurRow)
  }
  const tourRows = await knex.select('*').from('tours').orderBy('timestamp')
  for (const tourRow of tourRows) {
    tours.push(tourRow)
    if (!tourRow.dossard) continue

    const equipier = equipiers[tourRow.dossard]
    const equipe = equipes[equipier.equipe]
    if (!tourRow.duplicate) {
      equipier.tours += 1
      equipier.timestamp = tourRow.timestamp
      tourRow.duree = tourRow.timestamp - (_.last(equipe.tours)?.timestamp || 0)
      equipe.tours.push(tourRow)
      equipe.temps = tourRow.timestamp
    } else {
      equipe.duplicate.push(tourRow)
    }
  }
  calculClassements()
  await notifyAndGetHasChanged(() => {})
}

const addTranspondeur = async (dossard, id) => {
  transpondeurs[id] = { id, dossard }
  await knex.insert({ id, dossard }).into('transpondeurs')
}

const WINDOW_PERIOD = /*60 * */1000

const isDuplicate = (timestamp, equipe, offset = WINDOW_PERIOD) => {
  return equipe.tours.some(tour => {
    console.log(tour.id, tour.timestamp - offset, timestamp, tour.timestamp + offset)
    return tour.timestamp - offset < timestamp && timestamp < tour.timestamp + offset
  })
}

const addTour = async (id, transpondeur, timestamp, source = 'chrono') => {
  if (!(transpondeur in transpondeurs)) {
    const tour = { id, transpondeur, dossard: null, timestamp, source, duplicate: false }
    await knex.insert(tour).into('tours')
    tours.push(tour)
    await Promise.all(listeners.tours.map(callback => callback(tour)))
    return
  }
  const { dossard } = transpondeurs[transpondeur]
  const equipier = equipiers[dossard]
  if (!equipier) {
    const tour = { id, transpondeur, dossard, timestamp, source, duplicate: false }
    await knex.insert(tour).into('tours')
    tours.push(tour)
    await Promise.all(listeners.tours.map(callback => callback(tour)))
    return
  }

  const equipe = equipes[equipier.equipe]
  console.log('equipe', JSON.stringify(equipe))
  const duplicate = isDuplicate(timestamp, equipe);

  const tour = { id, transpondeur, dossard, timestamp, source, duplicate }
  await knex.insert(tour).into('tours')
  tours.push(tour)
  
  if (!duplicate) {
    equipier.tours += 1
    equipier.timestamp = Math.max(equipier.timestamp, timestamp)
    if (_.last(equipe.tours)?.timestamp < timestamp) {
      tour.duree = timestamp - (_.last(equipe.tours)?.timestamp || 0)
      equipe.tours.push(tour)
    } else {
      const index = _.findIndex(equipe.tours, tour => tour.timestamp > timestamp)
      tour.duree = timestamp - (equipe.tours[index - 1]?.timestamp || 0)
      equipe.tours.splice(index, 0, tour)
      equipe.tours[index + 1].duree = equipe.tours[index + 1].timestamp - timestamp
    }

    equipe.temps = Math.max(equipe.temps, timestamp)
    equipe._has_changed = true

    calculClassements(equipe)
  } else {
    equipe.duplicate.push(tour)
  }
  return Promise.all([
    notifyAndGetHasChanged(async equipe => {
      await Promise.all(listeners.equipes.map(callback => callback(equipe)))
    }),
    ...listeners.tours.map(callback => callback(tour, equipe, equipier))
  ])[0]
}

const notifyAndGetHasChanged = async (callback) => {
  let changed = []
  await Promise.all(_.map(equipes, async equipe => {
    if (!equipe._has_changed) return
    await callback(equipe)
    changed.push(equipe)
    equipe._has_changed = false
  }))
  return changed
}

const calculClassementCategory = categorie => {
  const rankValue = equipe => -equipe.tours.length * 100 * 3600 * 1000 + (equipe.temps || 0)
  categories[categorie] = _.sortBy(categories[categorie], rankValue)
  const key = categorie === 'general' ? 'position_general' : 'position_categorie'
  for (const [position, equipe] of categories[categorie].entries()) {
    if (!equipe.tours.length) continue
    equipe[key] = position + 1
  }
}

const calculClassements = (equipe = null) => {
  calculClassementCategory('general')
  for (const categorie of Object.keys(categories)) {
    if (!equipe || categorie === equipe.categorie) {
      calculClassementCategory(categorie)
    }
  }
}
const listeners = {
  equipes: [],
  tours: []
}
const addListener = (type, callback) => { listeners[type].push(callback) }
const removeListener = (type, callback) => { _.pull(listeners[type], callback) }

module.exports = {
  knex,
  initDb,
  reset,
  load,
  addTranspondeur,
  addTour,
  addListener,
  removeListener,
  equipes,
  equipiers,
  tours,
  transpondeurs,
  categories
}
