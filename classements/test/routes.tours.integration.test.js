/* global describe, it, before, beforeEach, afterEach, after */
import fs from 'node:fs/promises'
import path from 'node:path'
import Fastify from 'fastify'
import { expect } from 'chai'
import * as sql from '../sql.js'
import * as models from '../models.js'
import { STATUS, reset } from '../classes.js'
import { exists } from '../utils.js'
import toursRoute from '../routes/tours.js'

const previousDataDir = process.env.CLASSEMENTS_DATA_DIR
let testDataDir = null
let testDbPaths = []

function uniqueDbName(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

async function cleanupSqliteArtifacts(dbPath) {
  for (const artifact of [dbPath, `${dbPath}-journal`, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (await exists(artifact)) await fs.rm(artifact, { force: true })
  }
}

async function removeCurrentDbLinkIfAny() {
  try {
    await fs.rm(path.join(process.env.CLASSEMENTS_DATA_DIR || testDataDir, 'current.db'), { force: true })
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
}

async function createTempDb(prefix) {
  const name = uniqueDbName(prefix)
  const dbPath = path.join(testDataDir, `${name}.db`)
  testDbPaths.push(dbPath)
  await removeCurrentDbLinkIfAny()
  await sql.create(name)
}

async function seedTeam(knex, { equipe, dossard }) {
  await knex('equipes').insert({ equipe, nom: `Equipe ${equipe}`, categorie: 'A', penalite: 0, deleted: false })
  await knex('equipiers').insert({ equipe, dossard, nom: `Nom ${dossard}`, prenom: `Prenom ${dossard}`, deleted: false })
  await knex('transpondeurs').insert({ id: `TP-${dossard}`, dossard, deleted: false, vu: false, battery: null })
}

describe('routes GET /tours et /tours/count', function () {
  this.timeout(15000)
  let app

  before(async () => {
    testDataDir = await fs.mkdtemp(path.join(import.meta.dirname, '.tmp-sqlite-tours-'))
    process.env.CLASSEMENTS_DATA_DIR = testDataDir
  })

  async function closeAndReset() {
    const knex = sql.getKnex()
    if (knex && typeof knex.destroy !== 'function') sql.setKnex(null)
    await sql.close()
    reset()
  }

  beforeEach(async () => {
    testDbPaths = []
    await closeAndReset()
    app = Fastify()
    await app.register(toursRoute)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    await closeAndReset()
    for (const dbPath of testDbPaths) await cleanupSqliteArtifacts(dbPath)
  })

  after(async () => {
    if (previousDataDir === undefined) delete process.env.CLASSEMENTS_DATA_DIR
    else process.env.CLASSEMENTS_DATA_DIR = previousDataDir
    if (testDataDir) await fs.rm(testDataDir, { recursive: true, force: true })
  })

  it('pagine par curseur (timestamp, id) du plus recent au plus ancien', async () => {
    await createTempDb('it-tours-pagination')
    const knex = sql.getKnex()
    await seedTeam(knex, { equipe: 1, dossard: 11 })
    await knex('tours').insert([
      { id: 1, numero: 1, transpondeur: 'TP-11', dossard: 11, timestamp: 1000, source: 'chrono', status: null, deleted: false },
      { id: 2, numero: 2, transpondeur: 'TP-11', dossard: 11, timestamp: 2000, source: 'chrono', status: null, deleted: false },
      { id: 3, numero: 3, transpondeur: 'TP-11', dossard: 11, timestamp: 3000, source: 'chrono', status: null, deleted: false },
    ])
    await knex('course').update({ status: STATUS[2] })
    await sql.load()
    await models.changeStatus(STATUS[2])

    const page1 = await app.inject({ method: 'GET', url: '/tours?limit=2' })
    expect(page1.json()).to.deep.equal({
      tours: [
        { id: 3, numero: 3, transpondeur: 'TP-11', dossard: 11, timestamp: 3000, source: 'chrono', status: null, deleted: 0, numeroEquipe: 3, duree: 1000 },
        { id: 2, numero: 2, transpondeur: 'TP-11', dossard: 11, timestamp: 2000, source: 'chrono', status: null, deleted: 0, numeroEquipe: 2, duree: 1000 },
      ],
      hasMore: true,
    })

    const page2 = await app.inject({ method: 'GET', url: '/tours?limit=2&before=2000:2' })
    const body2 = page2.json()
    expect(body2.hasMore).to.equal(false)
    expect(body2.tours.map(t => t.id)).to.deep.equal([1])
  })

  it('filtre par statut, equipe et recherche', async () => {
    await createTempDb('it-tours-filters')
    const knex = sql.getKnex()
    await seedTeam(knex, { equipe: 1, dossard: 11 })
    await seedTeam(knex, { equipe: 2, dossard: 21 })
    await knex('tours').insert([
      { id: 1, numero: 1, transpondeur: 'TP-11', dossard: 11, timestamp: 1000, source: 'chrono', status: null, deleted: false },
      { id: 2, numero: 2, transpondeur: 'TP-11', dossard: 11, timestamp: 2000, source: 'chrono', status: 'duplicate', deleted: false },
      { id: 3, numero: 3, transpondeur: 'TP-21', dossard: 21, timestamp: 3000, source: 'chrono', status: null, deleted: false },
      { id: 4, numero: 4, transpondeur: 'TP-UNKNOWN', dossard: null, timestamp: 4000, source: 'chrono', status: null, deleted: false },
    ])
    await knex('course').update({ status: STATUS[2] })
    await sql.load()
    await models.changeStatus(STATUS[2])

    const duplicate = await app.inject({ method: 'GET', url: '/tours?status=duplicate' })
    expect(duplicate.json().tours.map(t => t.id)).to.deep.equal([2])

    const unknown = await app.inject({ method: 'GET', url: '/tours?status=unknown' })
    expect(unknown.json().tours.map(t => t.id)).to.deep.equal([4])

    const equipe1 = await app.inject({ method: 'GET', url: '/tours?equipe=1' })
    const equipe1Tours = equipe1.json().tours
    expect(equipe1Tours.map(t => t.id)).to.deep.equal([2, 1])
    // numeroEquipe/duree sont des getters (non persistes) : le tour normal les expose,
    // le doublon (status !== null) reste a null, comme cote WebSocket.
    expect(equipe1Tours.find(t => t.id === 1)).to.include({ numeroEquipe: 1, duree: 1000 })
    expect(equipe1Tours.find(t => t.id === 2)).to.include({ numeroEquipe: null, duree: null })

    const search = await app.inject({ method: 'GET', url: '/tours?search=TP-21' })
    expect(search.json().tours.map(t => t.id)).to.deep.equal([3])
  })

  it('/tours/count reflete getToursCounts()', async () => {
    await createTempDb('it-tours-count')
    const knex = sql.getKnex()
    await seedTeam(knex, { equipe: 1, dossard: 11 })
    await knex('tours').insert([
      { id: 1, numero: 1, transpondeur: 'TP-11', dossard: 11, timestamp: 1000, source: 'chrono', status: null, deleted: false },
      { id: 2, numero: 2, transpondeur: 'TP-11', dossard: 11, timestamp: 2000, source: 'chrono', status: 'deleted', deleted: false },
    ])
    await knex('course').update({ status: STATUS[2] })
    await sql.load()
    await models.changeStatus(STATUS[2])

    const res = await app.inject({ method: 'GET', url: '/tours/count' })
    expect(res.json()).to.deep.equal({ all: 2, normaux: 1, duplicate: 0, deleted: 1, unknown: 0 })
  })
})
