'use strict'
import _ from 'lodash'
import { AsyncEventEmitter } from './utils.js'
import { Tour, tours, transpondeurs, equipes, equipiers, categories, STATUS } from './classes.js'
import { getKnex } from './sql.js'

export const DUPLICATE_WINDOW_PERIOD = 60000 * 2
export const COURSE_DUREE = 6 * 3600 * 1000

let status = STATUS[0]

export const events = new AsyncEventEmitter();

export async function initModel() {
  const knex = getKnex()
  const [courseRow] = await knex.select('*').from('course')
  status = courseRow.status;
  for (const equipe of Object.values(equipes)) {
    if (equipe.tours.length) {
      equipe._rank = rankValue(equipe)
    }
  }
  calculClassements()
  await notifyAndGetHasChanged(() => {})
}

export async function addTranspondeur(transpondeur) {
  const previous = transpondeurs[transpondeur.id]
  console.log('transpondeur', transpondeur, previous)
  transpondeurs[transpondeur.id] = transpondeur
  const knex = getKnex()
  await knex.insert(transpondeur).into('transpondeurs').onConflict('id').merge()
  events.emit('transpondeur', transpondeur)
  if (previous?.dossard && previous.dossard !== transpondeur.dossard) {
    const equipier = equipiers[previous.dossard]
    if (equipier) {
      _.remove(equipier.transpondeurs, previous)
      events.emit('equipier', equipier)
    }
  }
  if (!transpondeur.dossard) return
  const equipier = equipiers[transpondeur.dossard]
  if (previous) _.remove(equipier.transpondeurs, previous)
  equipier.transpondeurs.push(transpondeur)
  events.emit('equipier', equipier)
}

export async function removeTranspondeur(id) {
  delete transpondeurs[id]
  const knex = getKnex()
  await knex('transpondeurs').where({ id }).delete()
}

export function isDuplicate(timestamp, equipe, offset = DUPLICATE_WINDOW_PERIOD) {
  const lastTimestamp = _.last(equipe.tours)?.timestamp
  if (lastTimestamp > COURSE_DUREE && timestamp >= lastTimestamp) return true
  return equipe.tours.some(tour => {
    return !tour.status && tour.timestamp < timestamp && timestamp < tour.timestamp + offset
  })
}

export async function insertTour(tour) {
    const knex = getKnex()
    const [id] = await knex.insert(_.omit(tour, ['duree'])).into('tours')
    tour.id = id
    if (tour.timestamp < _.last(tours)?.timestamp) {
      const pos = tours.findIndex(t => t.timestamp >= tour.timestamp)
      tours.splice(pos, 0, tour)
    } else {
      tours.push(tour)
    }
}

export async function addTour({ id, transpondeur = null, dossard = null, timestamp, source = 'chrono' }) {
  const tour = new Tour({ numero: id, transpondeur, dossard, timestamp, source, status: null })
  if (STATUS.indexOf(status) < 2) { // !course
    tour.status = 'ignore'
  }
  if (!dossard && !(transpondeur in transpondeurs)) {
    await addTranspondeur({ id: transpondeur, dossard: null, deleted: false })
  }
  if (!transpondeurs[transpondeur]?.deleted) {
    tour.dossard = transpondeurs[transpondeur]?.dossard || dossard
  }
  const equipier = equipiers[tour.dossard]
  console.log(equipier, transpondeurs[transpondeur])
  if (!equipier) {
    await insertTour(tour)
    tours.dossard = null
    events.emit('tours', tour)
    return
  }

  const equipe = equipes[equipier.equipe]
  if (!tour.status && isDuplicate(timestamp, equipe)) {
    tour.status = 'duplicate'
  };

  await insertTour(tour)
  
  if (!tour.status) {
    addTourToEquipe(equipe, tour)
    calculClassements(equipe)
  }
  return Promise.all([
    notifyAndGetHasChanged(async equipe => events.emit('equipes', equipe)),
    events.emit('tours', tour),
  ])[0]
}

export const addTourToEquipe = (equipe, tour) => {
  if (_.last(equipe.tours)?.timestamp < tour.timestamp) {
    // ce tour est le plus récent, on l'ajoute à la fin
    equipe.tours.push(tour)
  } else {
    // ce tour n'est pas le plus récent, il faut l'insérer au bon endroit
    const index = _.findIndex(equipe.tours, t => t.timestamp > tour.timestamp)
    equipe.tours.splice(index, 0, tour)
  }
  equipe.temps = Math.max(equipe.temps || 0, tour.timestamp)
  equipe._has_changed = true
  equipe._rank = rankValue(equipe)

}

export const rankValue = equipe => -(equipe.tours.length + equipe.penalite) * 100 * 3600 * 1000 + (equipe.temps || 0)

export const calculClassementCategory = categorie => {
  categories[categorie].sort((a, b) => (a._rank || 0) - (b._rank || 0))
  const key = categorie === 'general' ? 'position_general' : 'position_categorie'
  for (const [position, equipe] of categories[categorie].entries()) {
    if (!equipe.tours.length) continue
    equipe[key] = position + 1
  }
}

export const calculClassements = (equipe = null) => {
  for (const categorie of Object.keys(categories)) {
    if (categorie === 'general' || !equipe || categorie === equipe.categorie) {
      calculClassementCategory(categorie)
    }
  }
}

/*
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
*/

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
  const knex = getKnex()
  await knex('equipes').where({ equipe: id }).update(values)
  await notifyAndGetHasChanged(async equipe => events.emit('equipes', equipe))
}

export async function modifTour(id, deleted) {
  const tour = _.find(tours, t => t.id === id)
  if (!tour) return
  console.log('modify', id, deleted, tour)
  if (![null, 'duplicate', 'deleted'].includes(tour.status)) return
  if (tour.status === 'deleted' && deleted) return
  if (tour.status == null && !deleted) return
  tour.status = deleted ? 'deleted' : null
  const knex = getKnex()
  await knex('tours').where({ id }).update({ status: tour.status })
  const equipier = equipiers[tour.dossard]
  const equipe = equipes[equipier?.equipe]
  if (tour.dossard && equipier && equipe) {
    if (deleted) {
      _.remove(equipe.tours, tour)
    } else if (!_.find(equipe.tours, t => t === tour)) {
      addTourToEquipe(equipe, tour)
    }
    equipe.temps = _.last(equipe.tours).timestamp
    equipe._has_changed = true
    equipe._rank = rankValue(equipe)

    calculClassements(equipe)
  }
  return Promise.all([
    notifyAndGetHasChanged(async equipe => events.emit('equipes', equipe)),
    events.emit('tours', tour, equipe, equipier, true),
  ])[0]
}

export async function deplaceEquipier(dossard, numero) {
}

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
  const knex = getKnex()
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
  statusLock = false;
  status = _status
  const knex = getKnex()
  await knex('course').update({ status });
  events.emit('course', { status })
}

let statusLock = false;
export function lockStatus() {
  statusLock = true;
}

export async function syncStatus(chronoStatus) {
  if (statusLock) return
  const knex = getKnex()
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
