'use strict'
import _ from 'lodash'
import fs from 'node:fs/promises'
import { exists } from './utils.js'
import path from 'path'
import Knex from 'knex'
import klasses from './classes.js'
export const { Equipe, Equipier, Tour, Transpondeur, tours, transpondeurs, equipes, equipiers, categories } = klasses

export const DUPLICATE_WINDOW_PERIOD = 60000 * 2
export const COURSE_DUREE = 6 * 3600 * 1000

const DIR = './data'
const CURRENT_FILENAME = path.join(DIR, 'current.db')

export const STATUS = ['TEST', 'DEPART', 'COURSE', 'FIN']

const createDataDirectoryIfNotExists = async () => {
  if(!await exists(DIR))
    await fs.mkdir(DIR, {recursive: true})
}

let knex
export async function list() {
  await createDataDirectoryIfNotExists();
  const files = await fs.readdir(DIR)
  return files.filter(name => name.endsWith('.db') && name !== 'current.db')
}

export async function open(filename) {
  if (filename) {
    await close()
    await fs.symlink(filename, CURRENT_FILENAME)
  }
  if (!await exists(CURRENT_FILENAME)) return null
  knex = Knex({
    client: 'sqlite3',
    connection: {
      filename: CURRENT_FILENAME
    },
    useNullAsDefault: true,
  })
  await load()
  emit('open')
}

export async function create(name) {
  if (await exists(CURRENT_FILENAME)) throw new Error('current file link already exists')
  const filename = path.join(DIR, `${name.replace(/[^a-z0-9.()-]+/gi, '_')}.db`)
  knex = Knex({
    client: 'sqlite3',
    connection: { filename },
    useNullAsDefault: true,
  })
  await fs.symlink(filename, CURRENT_FILENAME)
  await initDb()
  await knex.insert({ name }).into('course')
}

export async function close() {
  if (knex) await knex.destroy()
  if (await exists(CURRENT_FILENAME)) await fs.rm(CURRENT_FILENAME)
  knex = null
  emit('close')
}
  
export function getKnex() { return  knex }
let status = STATUS[0]

export async function initDb() {
  if (!await knex.schema.hasTable('equipes')) {
    await knex.schema.createTable('course', (table) => {
      table.string('name')
      table.string('status').default(STATUS[0])
    })
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
      table.boolean('vu').defaultTo(false)
      table.integer('battery').nullable().defaultTo(null)
      table.foreign('dossard').references('dossard').inTable('equipiers')
      table.index(['dossard'])
      table.unique(['id'])
    })
    await knex.schema.createTable('tours', (table) => {
      table.increments('id')
      table.integer('numero')
      table.string('transpondeur')
      table.integer('dossard').nullable()
      table.integer('timestamp')
      table.string('source')
      table.string('status').nullable().default(null) // null, deleted, duplicate, ignore
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

export async function reset() {
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

export async function loadRows(klass, onRow) {
  const rows = await knex.select('*').from(klass.table)
  for (const row of rows) {
    const instance = new klass(row)
    klasses[klass.table][instance[klass.key]] = instance
    if (onRow) onRow(instance)
  }
}

export async function load() {
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

    const equipier = equipiers[tour.dossard]
    if (!equipier) {
        tour.dossard = null
        continue;
    }
    const equipe = equipes[equipier.equipe]
    if (!tour.status) {
      equipier.tours += 1
      equipier.timestamp = tour.timestamp
      equipe.tours.push(tour)
      equipe.temps = tour.timestamp
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

export async function addTranspondeur(transpondeur) {
  transpondeurs[transpondeur.id] = transpondeur
  await knex.insert(transpondeur).into('transpondeurs')
}

export async function removeTranspondeur(id) {
  delete transpondeurs[id]
  await knex('transpondeurs').where({ id }).delete()
}


export function isDuplicate(timestamp, equipe, offset = DUPLICATE_WINDOW_PERIOD) {
  const lastTimestamp = _.last(equipe.tours?.timestamp)
  if (lastTimestamp > COURSE_DUREE && timestamp >= lastTimestamp) return true
  return equipe.tours.some(tour => {
    return !tour.status && tour.timestamp < timestamp && timestamp < tour.timestamp + offset
  })
}

export async function insertTour(tour) {
    const [id] = await knex.insert(_.omit(tour, ['duree'])).into('tours')
    tour.id = id
    tours.push(tour)
}

export async function addTour(id, transpondeur, timestamp, source = 'chrono') {
  const tour = new Tour({ numero: id, transpondeur, dossard: null, timestamp, source, status: null })
  if (status !== STATUS[2]) { // !course
    tour.status = 'ignore'
  }
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
  if (!tour.status && isDuplicate(timestamp, equipe)) {
    tour.status = 'duplicate'
  };

  await insertTour(tour)
  
  if (!tour.status) {
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
  }
  return Promise.all([
    notifyAndGetHasChanged(async equipe => emit('equipes', equipe)),
    emit('tours', tour, equipe, equipier),
  ])[0]
}

const rankValue = equipe => -(equipe.tours.length + equipe.penalite) * 100 * 3600 * 1000 + (equipe.temps || 0)

const calculClassementCategory = categorie => {
  categories[categorie].sort((a, b) => (a._rank || 0) - (b._rank || 0))
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

export async function modifEquipe(id, values) {
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

export async function modifTour(id, deleted) {
  const tour = _.find(tours, t => t.id === id)
  if (!tour) return
  if (![null, 'duplicated', 'deleted'].includes(tour.status)) return
  if (tour.status === 'deleted' && deleted) return
  if ([null, 'duplicated'].includes(tour.status) && !deleted) return
  tour.status = deleted ? 'deleted' : null
  await knex('tours').where({ id }).update({ status: tour.status })
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

export async function deplaceEquipier(dossard, numero) {
}

// Async events
const listeners = {
}
export function on(type, callback) {
  if (!listeners[type]) listeners[type] = []
  listeners[type].push(callback)
}
export function removeListener(type, callback) { _.pull(listeners[type], callback) }
const emit = async (type, ...args) => listeners[type] && Promise.all(listeners[type].map(callback => callback(...args)))

export async function notifyAndGetHasChanged(callback) {
  let changed = []
  await Promise.all(_.map(equipes, async equipe => {
    if (!equipe._has_changed) return
    await callback(equipe)
    changed.push(equipe)
    equipe._has_changed = false
  }))
  return changed
}

export function getLastTourNumero() {
  const last = _.last(tours)
  if (status === 'TEST' && last?.status === 'ignore')  return last?.numero
  if (status !== 'TEST' && last?.status !== 'ignore')  return last?.numero
  return null
}

export async function getCourseInfo() {
  if (!knex) return
  const info = (await knex.select('*').from('course'))[0]
  if (!info) return
  status = info.status
  return info
}

export async function startTest() {
  await changeStatus(STATUS[0])
}

export async function stopTest() {
  await changeStatus(STATUS[1])
}

export async function startCourse() {
  await changeStatus(STATUS[2])
}

export async function stopCourse() {
  await changeStatus(STATUS[3])
}

export async function changeStatus(_status) {
  status = _status
  await knex('course').update({ status });
  emit('course', { status })
}

export async function syncStatus(chronoStatus) {
  if (!knex) return
  const index = STATUS.indexOf(status)
  if (chronoStatus === 'start') {
    if (index !== 1) return // si avant départ, retour en test
    await changeStatus(STATUS[0])
    return
  }
  if (chronoStatus === 'stop') {
    if (index % 2 === 1) return // si test -> avant départ
    await changeStatus(STATUS[index + 1]) // si course -> fin
    return
  }
}
