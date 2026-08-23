/* global describe, it, before, beforeEach, afterEach, after */
import fs from 'node:fs/promises'
import path from 'node:path'
import Fastify from 'fastify'
import { expect } from 'chai'
import * as sql from '../sql.js'
import * as models from '../models.js'
import { STATUS, reset } from '../classes.js'
import { exists } from '../utils.js'
import tourRoute from '../routes/tour.js'
import rootRoute from '../routes/root.js'
import transpondeursRoute from '../routes/transpondeurs.js'
import logsRoute from '../routes/logs.js'

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

describe('routes /tour, /equipe, /transpondeur -> journalisation dans log + GET /logs', function () {
  this.timeout(15000)
  let app

  before(async () => {
    testDataDir = await fs.mkdtemp(path.join(import.meta.dirname, '.tmp-sqlite-logs-'))
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
    await app.register(tourRoute)
    await app.register(rootRoute)
    await app.register(transpondeursRoute)
    await app.register(logsRoute)
    await app.ready()

    await createTempDb('it-logs')
    const knex = sql.getKnex()
    await seedTeam(knex, { equipe: 1, dossard: 11 })
    await knex('course').update({ status: STATUS[2] })
    await sql.load()
    await models.changeStatus(STATUS[2])
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

  it("journalise l'ajout d'un tour avec l'equipe deduite du dossard", async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tour',
      payload: { id: 1, transpondeur: 'TP-11', dossard: 11, timestamp: 1000 },
    })
    expect(res.statusCode).to.equal(200)

    const logs = await app.inject({ method: 'GET', url: '/logs' }).then(r => r.json().logs)
    expect(logs).to.have.length(1)
    expect(logs[0]).to.include({ action: "Ajout d'un tour", object_type: 'tour', equipe: 1 })
    expect(logs[0].data).to.include({ transpondeur: 'TP-11', dossard: 11, timestamp: 1000, status: null })
    expect(logs[0].timestamp).to.be.a('number')
  })

  it('journalise suppression puis restauration du tour, en reutilisant son id', async () => {
    await app.inject({
      method: 'POST',
      url: '/tour',
      payload: { id: 1, transpondeur: 'TP-11', dossard: 11, timestamp: 1000 },
    })
    const [addLog] = await app.inject({ method: 'GET', url: '/logs' }).then(r => r.json().logs)
    const tourId = Number(addLog.object_id)

    const del = await app.inject({ method: 'DELETE', url: `/tour/${tourId}` })
    expect(del.statusCode).to.equal(200)

    let logs = await app.inject({ method: 'GET', url: '/logs' }).then(r => r.json().logs)
    expect(logs[0]).to.include({ action: "Suppression d'un tour", object_type: 'tour', object_id: String(tourId), equipe: 1 })
    expect(logs[0].data).to.deep.equal({ status: 'deleted' })

    const restore = await app.inject({ method: 'POST', url: `/tour/${tourId}`, payload: { status: false } })
    expect(restore.statusCode).to.equal(200)

    logs = await app.inject({ method: 'GET', url: '/logs' }).then(r => r.json().logs)
    expect(logs[0]).to.include({ action: "Restauration d'un tour", object_type: 'tour', object_id: String(tourId), equipe: 1 })
    expect(logs[0].data).to.deep.equal({ status: null })
    expect(logs).to.have.length(3)
  })

  it("ne journalise rien quand la modification de tour n'a pas d'effet (transition interdite)", async () => {
    const res = await app.inject({ method: 'POST', url: '/tour/999999', payload: { status: false } })
    expect(res.statusCode).to.equal(200)

    const logs = await app.inject({ method: 'GET', url: '/logs' }).then(r => r.json().logs)
    expect(logs).to.have.length(0)
  })

  it("journalise l'ajout d'un transpondeur non affecte a une equipe (equipe = null)", async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/transpondeur',
      headers: { 'content-type': 'text/plain' },
      payload: JSON.stringify({ id: 'TP-UNKNOWN', dossard: null, deleted: false }),
    })
    expect(res.statusCode).to.equal(200)

    const logs = await app.inject({ method: 'GET', url: '/logs' }).then(r => r.json().logs)
    expect(logs).to.have.length(1)
    expect(logs[0]).to.include({ action: "Ajout/modification d'un transpondeur", object_type: 'transpondeur', object_id: 'TP-UNKNOWN', equipe: null })
    expect(logs[0].data).to.deep.equal({ id: 'TP-UNKNOWN', dossard: null, deleted: false })
  })

  it("journalise la modification d'une equipe", async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/equipe/1',
      payload: { commentaire: 'A contacter avant le depart' },
    })
    expect(res.statusCode).to.equal(200)

    const logs = await app.inject({ method: 'GET', url: '/logs' }).then(r => r.json().logs)
    expect(logs).to.have.length(1)
    expect(logs[0]).to.include({ action: "Modification d'une équipe", object_type: 'equipe', object_id: '1', equipe: 1 })
    expect(logs[0].data).to.deep.equal({ commentaire: 'A contacter avant le depart' })
  })

  it('GET /logs?equipe filtre sur l\'equipe et laisse les logs sans equipe de cote', async () => {
    await app.inject({ method: 'POST', url: '/tour', payload: { id: 1, transpondeur: 'TP-11', dossard: 11, timestamp: 1000 } })
    await app.inject({
      method: 'POST',
      url: '/transpondeur',
      headers: { 'content-type': 'text/plain' },
      payload: JSON.stringify({ id: 'TP-UNKNOWN', dossard: null, deleted: false }),
    })
    await app.inject({ method: 'POST', url: '/equipe/1', payload: { commentaire: 'ok' } })

    const all = await app.inject({ method: 'GET', url: '/logs' }).then(r => r.json().logs)
    expect(all).to.have.length(3)

    const forTeam1 = await app.inject({ method: 'GET', url: '/logs?equipe=1' }).then(r => r.json().logs)
    expect(forTeam1).to.have.length(2)
    expect(forTeam1.every(log => log.equipe === 1)).to.equal(true)
    // le plus recent en premier
    expect(forTeam1.map(l => l.object_type)).to.deep.equal(['equipe', 'tour'])
  })
})
