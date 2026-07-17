import fs from 'node:fs/promises'
import { AsyncEventEmitter } from './utils.js'
import path from 'path'
import Knex from 'knex'
import * as klasses from './classes.js'
import { Tour, Equipe, Equipier, Transpondeur, tours, equipes, equipiers, transpondeurs, categories, STATUS, reset, adjustTourCount, adjustToursPerMinute } from './classes.js'

const __dirname = import.meta.dirname;
const DEFAULT_DIR = path.join(__dirname, './data')

const getDir = () => process.env.CLASSEMENTS_DATA_DIR || DEFAULT_DIR
const getCurrentFilename = () => path.join(getDir(), 'current.db')

async function entryExists(filename) {
  try {
    await fs.lstat(filename)
    return true
  } catch (err) {
    if (err.code === 'ENOENT') return false
    throw err
  }
}

export const events = new AsyncEventEmitter();

let knex
export async function list() {
  const DIR = getDir()
  await fs.mkdir(DIR, { recursive: true })
  const files = await fs.readdir(DIR)
  return files.filter(name => name.endsWith('.db') && name !== 'current.db')
}

export async function open(filename) {
  const DIR = getDir()
  const CURRENT_FILENAME = getCurrentFilename()
  if (filename) {
    await close()
    await fs.mkdir(DIR, { recursive: true })
    await fs.symlink(path.resolve(DIR, filename), CURRENT_FILENAME)
  }
  if (!await entryExists(CURRENT_FILENAME)) return null
  knex = Knex({
    client: 'sqlite3',
    connection: {
      filename: CURRENT_FILENAME
    },
    useNullAsDefault: true,
  })
  await load()
  events.emit('open')
  return knex
}

export async function create(name) {
  const DIR = getDir()
  const CURRENT_FILENAME = getCurrentFilename()
  await fs.mkdir(DIR, { recursive: true })
  if (await entryExists(CURRENT_FILENAME)) throw new Error('current file link already exists')
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
  const CURRENT_FILENAME = getCurrentFilename()
  if (knex) await knex.destroy()
  if (await entryExists(CURRENT_FILENAME)) await fs.rm(CURRENT_FILENAME)
  knex = null
  reset()
  events.emit('close')
}
  
export function getKnex() { return  knex }
export function setKnex(k) { return  knex = k }

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
      table.integer('numero').nullable()
      table.string('transpondeur')
      table.integer('dossard').nullable()
      table.integer('timestamp')
      table.string('source')
      table.string('status').nullable().default(null) // null, deleted, duplicate, ignore
      table.boolean('deleted', false)
      table.unique(['id'])
      table.foreign('dossard').references('dossard').inTable('equipiers')
      table.index(['dossard'])
      table.index(['timestamp', 'id']) // pagination par curseur (keyset) sur GET /tours
    })
    await knex.schema.createTable('log', (table) => {
        table.integer('timestamp')
        table.string('table')
        table.string('values')
    });
  }
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
  reset();
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
    adjustTourCount(tour, tour.status, 1)
    if (tour.status === null) adjustToursPerMinute(tour.timestamp, 1)
    if (tour.transpondeur && transpondeurs[tour.transpondeur]) {
      const transpondeur = transpondeurs[tour.transpondeur]
      transpondeur.passages = (transpondeur.passages || 0) + 1
      transpondeur.lastSeen = tour.timestamp
    }
    if (!tour.dossard) continue

    const equipier = equipiers[tour.dossard]
    if (!equipier) {
        tour.dossard = null
        continue;
    }
    const equipe = equipes[equipier.equipe]
    if (!tour.status) {
      equipe.tours.push(tour)
      equipe.temps = tour.timestamp
    }
  }
}
