/* global describe, it, before, beforeEach, afterEach, after */
import fs from 'node:fs/promises'
import path from 'node:path'
import Fastify from 'fastify'
import { expect } from 'chai'
import { parse } from 'csv-parse/sync'
import * as sql from '../sql.js'
import * as models from '../models.js'
import { STATUS, reset } from '../classes.js'
import { exists } from '../utils.js'
import exportRoute from '../routes/export.js'

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

async function createTempDb(displayName) {
  const name = uniqueDbName('it-export')
  const dbPath = path.join(testDataDir, `${name}.db`)
  testDbPaths.push(dbPath)
  await removeCurrentDbLinkIfAny()
  await sql.create(name)
  await sql.getKnex()('course').update({ name: displayName })
}

async function seedTeam(knex, { equipe, dossard, categorie = 'A', penalite = 0, nom }) {
  await knex('equipes').insert({ equipe, nom: nom || `Equipe ${equipe}`, categorie, penalite, deleted: false })
  await knex('equipiers').insert({ equipe, dossard, nom: `Nom ${dossard}`, prenom: `Prenom ${dossard}`, deleted: false })
  await knex('transpondeurs').insert({ id: `TP-${dossard}`, dossard, deleted: false, vu: false, battery: null })
}

describe('routes GET /export/*.csv', function () {
  this.timeout(15000)
  let app

  before(async () => {
    testDataDir = await fs.mkdtemp(path.join(import.meta.dirname, '.tmp-sqlite-export-'))
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
    await app.register(exportRoute)
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

  it('exporte les equipes en CSV, triees par position generale, avec le nom de la course dans le nom de fichier', async () => {
    await createTempDb("Ma Course d'Ete")
    const knex = sql.getKnex()
    await seedTeam(knex, { equipe: 1, dossard: 11, categorie: 'A', penalite: 1, nom: 'Team A' })
    await seedTeam(knex, { equipe: 2, dossard: 21, categorie: 'B', penalite: 0, nom: 'Team B' })
    await knex('tours').insert([
      { id: 1, numero: 1, transpondeur: 'TP-11', dossard: 11, timestamp: 1000, source: 'chrono', status: null, deleted: false },
      { id: 2, numero: 2, transpondeur: 'TP-21', dossard: 21, timestamp: 5500, source: 'chrono', status: null, deleted: false },
      { id: 3, numero: 3, transpondeur: 'TP-21', dossard: 21, timestamp: 9000, source: 'chrono', status: null, deleted: false },
    ])
    await knex('course').update({ status: STATUS[2] })
    await sql.load()
    await models.changeStatus(STATUS[2])
    await models.initModel()

    const res = await app.inject({ method: 'GET', url: '/export/classements.csv' })
    expect(res.statusCode).to.equal(200)
    expect(res.headers['content-type']).to.include('text/csv')
    expect(res.headers['content-disposition']).to.equal(
      `attachment; filename*=UTF-8''${encodeURIComponent("Ma Course d'Ete - classements.csv")}`
    )

    const rows = parse(res.body, { columns: true })
    expect(rows).to.deep.equal([
      { numero: '1', temps: '1.000', tours: '2', position_generale: '1', position_categorie: '1', nom: 'Team A', categorie: 'A' },
      { numero: '2', temps: '9.000', tours: '2', position_generale: '2', position_categorie: '1', nom: 'Team B', categorie: 'B' },
    ])
  })

  it('exporte les tours en CSV, tries par timestamp croissant, avec le nom de la course dans le nom de fichier', async () => {
    await createTempDb("Ma Course d'Ete")
    const knex = sql.getKnex()
    await seedTeam(knex, { equipe: 1, dossard: 11 })
    await seedTeam(knex, { equipe: 2, dossard: 21 })
    await knex('tours').insert([
      { id: 1, numero: 1, transpondeur: 'TP-11', dossard: 11, timestamp: 1000, source: 'chrono', status: null, deleted: false },
      { id: 2, numero: 2, transpondeur: 'TP-11', dossard: 11, timestamp: 4000, source: 'chrono', status: null, deleted: false },
      { id: 3, numero: 3, transpondeur: 'TP-21', dossard: 21, timestamp: 5500, source: 'chrono', status: null, deleted: false },
      { id: 4, numero: 4, transpondeur: 'TP-21', dossard: 21, timestamp: 9000, source: 'chrono', status: null, deleted: false },
    ])
    await knex('course').update({ status: STATUS[2] })
    await sql.load()
    await models.changeStatus(STATUS[2])
    await models.initModel()

    const res = await app.inject({ method: 'GET', url: '/export/tours.csv' })
    expect(res.statusCode).to.equal(200)
    expect(res.headers['content-type']).to.include('text/csv')
    expect(res.headers['content-disposition']).to.equal(
      `attachment; filename*=UTF-8''${encodeURIComponent("Ma Course d'Ete - tours.csv")}`
    )

    const rows = parse(res.body, { columns: true })
    expect(rows).to.deep.equal([
      { id: '1', dossard: '11', numero: '1', duree: '1.000', timestamp: '1.000' },
      { id: '2', dossard: '11', numero: '2', duree: '3.000', timestamp: '4.000' },
      { id: '3', dossard: '21', numero: '1', duree: '5.500', timestamp: '5.500' },
      { id: '4', dossard: '21', numero: '2', duree: '3.500', timestamp: '9.000' },
    ])
  })
})
