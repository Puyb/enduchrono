'use strict'
const _ = require('lodash')
const klasses = require('./classes')
const { Equipe, Equipier, Tour, Transpondeur, tours, transpondeurs, equipes, equipiers, categories } = klasses

const DUPLICATE_WINDOW_PERIOD = /*60000*/1000
const COURSE_DUREE = 6 * 3600 * 1000

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
      table.integer('penalite').defaultTo(0)
      table.boolean('deleted')
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
      table.boolean('deleted')
      table.unique(['dossard'])
    })
    await knex.schema.createTable('transpondeurs', (table) => {
      table.integer('dossard').nullable()
      table.string('id')
      table.boolean('deleted')
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
      table.boolean('deleted', false)
      table.unique(['id'])
      table.foreign('dossard').references('dossard').inTable('equipiers')
      table.index(['dossard'])
    })
    await knex.schema.createTable('log', (table) => {
        table.integer('timestamp')
        table.string('table')
        table.string('values')
    });
  }
}

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

const loadRows = async (klass, onRow) => {
  const rows = await knex.select('*').from(klass.table)
  for (const row of rows) {
    const instance = new klass(row)
    klasses[klass.table][instance[klass.key]] = instance
    if (onRow) onRow(instance)
  }
}

const load = async () => {
  await loadRows(Equipe, equipe => {
    categories.general.push(equipe)
    categories[equipe.categorie] = categories[equipe.categorie] || []
    categories[equipe.categorie].push(equipe)
  })
  await loadRows(Equipier)
  await loadRows(Transpondeur, transpondeur => {
    if (equipiers[transpondeur.dossard]) {
      equipiers[transpondeur.dossard].transpondeurs.push(transpondeur)
    }
  })
  const tourRows = await knex.select('*').from('tours').orderBy('timestamp')
  for (const tourRow of tourRows) {
    const tour = new Tour(tourRow)
    tours.push(tour)
    if (!tour.dossard) continue
    if (tour.deleted) continue

    const equipier = equipiers[tour.dossard]
    if (!equipier) {
        tour.dossard = null
        continue;
    }
    const equipe = equipes[equipier.equipe]
    if (!tour.duplicate) {
      equipier.tours += 1
      equipier.timestamp = tour.timestamp
      equipe.tours.push(tour)
      equipe.temps = tour.timestamp
    } else {
      equipe.duplicate.push(tour)
    }
  }
  for (const equipe of Object.values(equipes)) {
    if (equipe.tours.length) {
      equipe._rank = rankValue(equipe)
    }
  }
  calculClassements()
  await notifyAndGetHasChanged(() => {})
}

const addTranspondeur = async (transpondeur) => {
  transpondeurs[transpondeur.id] = transpondeur
  await knex.insert(transpondeur).into('transpondeurs')
}

const removeTranspondeur = async (transpondeur) => {
  delete transpondeurs[id]
  await knex('transpondeurs').where({ id }).delete()
}


const isDuplicate = (timestamp, equipe, offset = DUPLICATE_WINDOW_PERIOD) => {
  const lastTimestamp = _.last(equipe.tours?.timestamp)
  if (lastTimestamp > COURSE_DUREE && timestamp >= lastTimestamp) return true
  return equipe.tours.some(tour => {
    return tour.timestamp - offset < timestamp && timestamp < tour.timestamp + offset
  })
}

const insertTour = async (tour) => {
    await knex.insert(_.omit(tour, ['duree'])).into('tours')
    tours.push(new Tour(tour))
}

const addTour = async (id, transpondeur, timestamp, source = 'chrono') => {
  const tour = new Tour({ id, transpondeur, dossard: null, timestamp, source, duplicate: false })
  if (!(transpondeur in transpondeurs)) {
    await insertTour(tour)
    await addTranspondeur({ id: transpondeur, dossard: null, deleted: false })
    emit('tours', tour)
    emit('transpondeur', { id: transpondeur })
    return
  }
  tour.dossard = transpondeurs[transpondeur]?.dossard
  const equipier = equipiers[tour.dossard]
  if (!equipier) {
    await insertTour(tour)
    tours.dossard = null
    emit('tours', tour)
    return
  }

  const equipe = equipes[equipier.equipe]
  tour.duplicate = isDuplicate(timestamp, equipe);

  await insertTour(tour)
  
  if (!tour.duplicate) {
    equipier.tours += 1
    equipier.timestamp = Math.max(equipier.timestamp, timestamp)
    if (_.last(equipe.tours)?.timestamp < timestamp) {
      // ce tour est le plus récent, on l'ajoute à la fin
      equipe.tours.push(tour)
    } else {
      // ce tour n'est pas le plus récent, il faut l'insérer au bon endroit
      const index = _.findIndex(equipe.tours, tour => tour.timestamp > timestamp)
      equipe.tours.splice(index, 0, tour)
    }

    equipe.temps = Math.max(equipe.temps, timestamp)
    equipe._has_changed = true

    equipe._rank = rankValue(equipe)

    calculClassements(equipe)
  } else {
    equipe.duplicate.push(tour)
  }
  return Promise.all([
    notifyAndGetHasChanged(async equipe => emit('equipes', equipe)),
    emit('tours', tour, equipe, equipier),
  ])[0]
}

const rankValue = equipe => -(equipe.tours.length + equipe.penalite) * 100 * 3600 * 1000 + (equipe.temps || 0)

const calculClassementCategory = categorie => {
  categories[categorie].sort((a, b) => a._rank - b._rank)
  const key = categorie === 'general' ? 'position_general' : 'position_categorie'
  for (const [position, equipe] of categories[categorie].entries()) {
    if (!equipe.tours.length) continue
    equipe[key] = position + 1
  }
}

const calculClassements = (equipe = null) => {
  for (const categorie of Object.keys(categories)) {
    if (categorie === 'general' || !equipe || categorie === equipe.categorie) {
      calculClassementCategory(categorie)
    }
  }
}

const updateClassement = (equipe, categoriesToUpdate = ['general', equipe.categorie]) => {
      console.log(categoriesToUpdate)
  for (const categorie of categoriesToUpdate) {
    const list = categories[categorie]
    const current = list.indexOf(equipe)
    let i = current;
    let dir = 0
    let comp = i => list[i]._rank > equipe._rank
    if (i > 0 && comp(i - 1)) dir = -1
    if (!dir) comp = i => list[i]._rank < equipe._rank
    if (!dir && i < list.length - 1 && comp(i + 1)) dir = +1
    if (!dir) continue
    const key = categorie === 'general' ? 'position_general' : 'position_categorie'
    console.log(key, i, dir)
    while (list[i + dir] && comp(i + dir)) {
      i += dir
      console.log('>', i, list[i])
      list[i][key] -= dir
    }
    console.log(i)
    list.splice(current, 1)
    list.splice(i, 0, equipe)
    equipe[key] = i + 1
    console.log(JSON.stringify(list, null, 2))
  }
}

const modifEquipe = async (id, values) => {
  const equipe = equipes[id]
  if ('penalite' in values) {
    equipe.penalite = values.penalite
    calculClassements(equipe)
  }
  if (values.categorie) {
    _.pull(categories[equipe.categorie], equipe)
    calculClassementCategory(equipe.categorie)
    equipe.categorie = values.categorie
    categories[equipe.categorie].push(equipe)
    calculClassementCategory(equipe.categorie)
  }
  equipe._has_changed = true
  await knex('equipes').where({ equipe: id }).update(values)
  await notifyAndGetHasChanged(async equipe => emit('equipes', equipe))
}

const modifTour = async (id, deleted) => {
  const tour = _.find(tours, t => t.id === id)
  if (!tour) return
  if (tour.deleted === deleted) return
  tour.deleted = deleted
  await knex('tours').where({ id }).update({ deleted })
  const equipier = equipiers[tour.dossard]
  const equipe = equipes[equipier?.equipe]
  if (tour.dossard && equipier && equipe) {
    equipier.tours--
    _.remove(equipe.tours, tour)

    calculClassements(equipe)
  }
  return Promise.all([
    notifyAndGetHasChanged(async equipe => emit('equipes', equipe)),
    emit('tours', tour, equipe, equipier, true),
  ])[0]
}

const deplaceEquipier = async (dossard, numero) => {
}

const listeners = {
  equipes: [],
  tours: [],
  transpondeur: [],
}
const addListener = (type, callback) => { listeners[type].push(callback) }
const removeListener = (type, callback) => { _.pull(listeners[type], callback) }
const emit = async (type, ...args) => Promise.all(listeners[type].map(callback => callback(...args)))

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

module.exports = {
  knex,
  initDb,
  reset,
  load,
  addTranspondeur,
  removeTranspondeur,
  addTour,
  addListener,
  removeListener,
  equipes,
  equipiers,
  tours,
  transpondeurs,
  categories,
  modifEquipe,
  modifTour,
  rankValue,
  updateClassement,
  DUPLICATE_WINDOW_PERIOD,
  COURSE_DUREE,
}
