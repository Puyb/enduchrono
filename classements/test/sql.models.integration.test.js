/* global describe, it, before, beforeEach, afterEach, after */
import fs from 'node:fs/promises'
import path from 'node:path'
import { expect } from 'chai'
import * as sql from '../sql.js'
import * as models from '../models.js'
import {
  STATUS,
  reset,
  tours,
  equipes,
  equipiers,
  transpondeurs,
  categories,
} from '../classes.js'
import { exists } from '../utils.js'

const previousDataDir = process.env.CLASSEMENTS_DATA_DIR
let testDataDir = null

const currentDbPath = () => path.join(process.env.CLASSEMENTS_DATA_DIR || testDataDir, 'current.db')

let testDbPaths = []

function uniqueDbName(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

async function cleanupSqliteArtifacts(dbPath) {
  const artifacts = [dbPath, `${dbPath}-journal`, `${dbPath}-wal`, `${dbPath}-shm`]
  for (const artifact of artifacts) {
    if (await exists(artifact)) {
      await fs.rm(artifact, { force: true })
    }
  }
}

async function removeCurrentDbLinkIfAny() {
  try {
    await fs.rm(currentDbPath(), { force: true })
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
}

async function closeAndReset() {
  const knex = sql.getKnex()
  if (knex && typeof knex.destroy !== 'function') {
    sql.setKnex(null)
  }
  await sql.close()
  await removeCurrentDbLinkIfAny()
  reset()
}

async function createTempDb(prefix) {
  if (!testDataDir) throw new Error('testDataDir is not initialized')
  const name = uniqueDbName(prefix)
  const filename = `${name}.db`
  const dbPath = path.join(testDataDir, filename)
  testDbPaths.push(dbPath)
  await removeCurrentDbLinkIfAny()
  await sql.create(name)
  return { name, filename, dbPath }
}

async function seedTeam(knex, { equipe, dossard, categorie = 'A', penalite = 0 }) {
  await knex('equipes').insert({
    equipe,
    nom: `Equipe ${equipe}`,
    categorie,
    penalite,
    deleted: false,
  })
  await knex('equipiers').insert({
    equipe,
    dossard,
    nom: `Nom ${dossard}`,
    prenom: `Prenom ${dossard}`,
    deleted: false,
  })
  await knex('transpondeurs').insert({
    id: `TP-${dossard}`,
    dossard,
    deleted: false,
    vu: false,
    battery: null,
  })
}

describe('integration sqlite <-> memoire (backend)', function () {
  this.timeout(15000)

  before(async () => {
    testDataDir = await fs.mkdtemp(path.join(import.meta.dirname, '.tmp-sqlite-it-'))
    process.env.CLASSEMENTS_DATA_DIR = testDataDir
  })

  beforeEach(async () => {
    testDbPaths = []
    await closeAndReset()
  })

  afterEach(async () => {
    await closeAndReset()
    for (const dbPath of testDbPaths) {
      await cleanupSqliteArtifacts(dbPath)
    }
  })

  after(async () => {
    await closeAndReset()
    if (previousDataDir === undefined) {
      delete process.env.CLASSEMENTS_DATA_DIR
    } else {
      process.env.CLASSEMENTS_DATA_DIR = previousDataDir
    }
    if (testDataDir) {
      await fs.rm(testDataDir, { recursive: true, force: true })
      testDataDir = null
    }
  })

  it('create initialise le schema et la ligne course', async () => {
    const { name, filename } = await createTempDb('it-create-schema')
    const knex = sql.getKnex()

    const tableRows = await knex('sqlite_master').select('name').where({ type: 'table' })
    const tableNames = tableRows.map(row => row.name)
    expect(tableNames).to.include.members(['course', 'equipes', 'equipiers', 'transpondeurs', 'tours', 'log'])

    const [courseRow] = await knex.select('*').from('course')
    expect(courseRow).to.include({ name, status: STATUS[0] })

    expect(await exists(currentDbPath())).to.equal(true)
    expect(await sql.list()).to.include(filename)
  })

  it('load reconstruit equipes/equipiers/transpondeurs/tours/categories', async () => {
    await createTempDb('it-load-rebuild')
    const knex = sql.getKnex()

    await seedTeam(knex, { equipe: 1, dossard: 11, categorie: 'SNX' })
    await seedTeam(knex, { equipe: 2, dossard: 21, categorie: 'DUO' })
    await knex('transpondeurs').insert({ id: 'TP-UNKNOWN', dossard: null, deleted: false, vu: false, battery: null })

    await knex('tours').insert([
      { id: 1, numero: 1, transpondeur: 'TP-11', dossard: 11, timestamp: 1000, source: 'chrono', status: null, deleted: false },
      { id: 2, numero: 2, transpondeur: 'TP-11', dossard: 11, timestamp: 1100, source: 'chrono', status: 'deleted', deleted: false },
      { id: 3, numero: 3, transpondeur: 'TP-21', dossard: 21, timestamp: 900, source: 'chrono', status: null, deleted: false },
      { id: 4, numero: 4, transpondeur: 'TP-21', dossard: 99, timestamp: 1200, source: 'chrono', status: null, deleted: false },
      { id: 5, numero: 5, transpondeur: 'TP-11', dossard: 11, timestamp: 1300, source: 'chrono', status: 'duplicate', deleted: false },
    ])

    await sql.load()

    expect(Object.keys(equipes)).to.have.members(['1', '2'])
    expect(Object.keys(equipiers)).to.have.members(['11', '21'])
    expect(Object.keys(transpondeurs)).to.include.members(['TP-11', 'TP-21', 'TP-UNKNOWN'])

    expect(equipiers[11].transpondeurs.map(t => t.id)).to.deep.equal(['TP-11'])
    expect(equipiers[21].transpondeurs.map(t => t.id)).to.deep.equal(['TP-21'])

    expect(tours.map(t => t.id)).to.deep.equal([3, 1, 2, 4, 5])
    expect(tours.find(t => t.id === 4).dossard).to.equal(null)

    expect(equipes[1].tours.map(t => t.id)).to.deep.equal([1])
    expect(equipes[2].tours.map(t => t.id)).to.deep.equal([3])
    expect(equipes[1].temps).to.equal(1000)
    expect(equipes[2].temps).to.equal(900)

    expect(categories.general.map(equipe => equipe.equipe)).to.have.members([1, 2])
    expect(categories.SNX.map(equipe => equipe.equipe)).to.deep.equal([1])
    expect(categories.DUO.map(equipe => equipe.equipe)).to.deep.equal([2])
  })

  it('open/close charge la bonne base puis remet a zero connexion + memoire + current.db', async () => {
    const fixtureA = await createTempDb('it-open-close-a')
    let knex = sql.getKnex()
    await seedTeam(knex, { equipe: 1, dossard: 11, categorie: 'A' })
    await knex('tours').insert({
      id: 1,
      numero: 1,
      transpondeur: 'TP-11',
      dossard: 11,
      timestamp: 1000,
      source: 'chrono',
      status: null,
      deleted: false,
    })
    await sql.close()

    const fixtureB = await createTempDb('it-open-close-b')
    knex = sql.getKnex()
    await seedTeam(knex, { equipe: 2, dossard: 21, categorie: 'B' })
    await knex('tours').insert({
      id: 2,
      numero: 2,
      transpondeur: 'TP-21',
      dossard: 21,
      timestamp: 2000,
      source: 'chrono',
      status: null,
      deleted: false,
    })
    await sql.close()

    await sql.open(fixtureA.filename)
    expect(sql.getKnex()).to.not.equal(null)
    expect(Object.keys(equipes)).to.have.members(['1'])
    expect(equipes[1].tours.map(t => t.id)).to.deep.equal([1])

    await sql.open(fixtureB.filename)
    expect(Object.keys(equipes)).to.have.members(['2'])
    expect(equipes[2].tours.map(t => t.id)).to.deep.equal([2])
    expect(await exists(currentDbPath())).to.equal(true)

    await sql.close()
    expect(sql.getKnex()).to.equal(null)
    expect(await exists(currentDbPath())).to.equal(false)
    expect(tours).to.have.length(0)
    expect(Object.keys(equipes)).to.have.length(0)
    expect(Object.keys(equipiers)).to.have.length(0)
    expect(Object.keys(transpondeurs)).to.have.length(0)
    expect(categories.general).to.have.length(0)
  })

  it('initModel charge le status depuis course et calcule ranks/positions', async () => {
    const fixture = await createTempDb('it-init-model')
    const knex = sql.getKnex()

    await seedTeam(knex, { equipe: 1, dossard: 11, categorie: 'A' })
    await seedTeam(knex, { equipe: 2, dossard: 21, categorie: 'A' })
    await seedTeam(knex, { equipe: 3, dossard: 31, categorie: 'B' })

    await knex('tours').insert([
      { id: 1, numero: 1, transpondeur: 'TP-11', dossard: 11, timestamp: 1000, source: 'chrono', status: null, deleted: false },
      { id: 2, numero: 2, transpondeur: 'TP-21', dossard: 21, timestamp: 1500, source: 'chrono', status: null, deleted: false },
      { id: 3, numero: 3, transpondeur: 'TP-11', dossard: 11, timestamp: 2000, source: 'chrono', status: null, deleted: false },
    ])

    await knex('course').update({ status: STATUS[2] })
    await sql.close()

    await sql.open(fixture.filename)
    await models.changeStatus(STATUS[0])
    await sql.getKnex()('course').update({ status: STATUS[2] })

    expect(models.getLastTourNumero()).to.equal(null)

    await models.initModel()

    expect(models.getLastTourNumero()).to.equal(3)
    expect(equipes[1]._rank).to.equal(models.rankValue(equipes[1]))
    expect(equipes[2]._rank).to.equal(models.rankValue(equipes[2]))
    expect(categories.general.map(equipe => equipe.equipe)).to.deep.equal([1, 2, 3])

    expect(equipes[1].position_general).to.equal(1)
    expect(equipes[2].position_general).to.equal(2)
    expect(equipes[3].position_general).to.equal(undefined)

    expect(equipes[1].position_categorie).to.equal(1)
    expect(equipes[2].position_categorie).to.equal(2)
    expect(equipes[3].position_categorie).to.equal(undefined)
  })

  it('modifTour persiste suppression/restauration dans sqlite et en memoire', async () => {
    const fixture = await createTempDb('it-modif-tour')
    const knex = sql.getKnex()

    await seedTeam(knex, { equipe: 1, dossard: 11, categorie: 'A' })
    await knex('course').update({ status: STATUS[2] })
    await knex('tours').insert([
      { id: 1, numero: 1, transpondeur: 'TP-11', dossard: 11, timestamp: 1000, source: 'chrono', status: null, deleted: false },
      { id: 2, numero: 2, transpondeur: 'TP-11', dossard: 11, timestamp: 2000, source: 'chrono', status: null, deleted: false },
    ])

    await sql.close()
    await sql.open(fixture.filename)
    await models.initModel()

    expect(equipes[1].tours.map(t => t.id)).to.deep.equal([1, 2])

    await models.modifTour(2, true)

    let [tourRow] = await sql.getKnex().select('*').from('tours').where({ id: 2 })
    expect(tourRow.status).to.equal('deleted')
    expect(tours.find(t => t.id === 2).status).to.equal('deleted')
    expect(equipes[1].tours.map(t => t.id)).to.deep.equal([1])
    expect(equipes[1].temps).to.equal(1000)

    await models.modifTour(2, false)

    const restoredRows = await sql.getKnex().select('*').from('tours').where({ id: 2 })
    tourRow = restoredRows[0]
    expect(tourRow.status).to.equal(null)
    expect(tours.find(t => t.id === 2).status).to.equal(null)
    expect(equipes[1].tours.map(t => t.id)).to.deep.equal([1, 2])
    expect(equipes[1].temps).to.equal(2000)
  })
})
