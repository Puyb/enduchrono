/* global describe, it, before, beforeEach, afterEach, after */
import fs from 'node:fs/promises'
import path from 'node:path'
import { expect } from 'chai'
import * as sql from '../sql.js'
import { reset } from '../classes.js'
import { exists } from '../utils.js'
import { logAction, listActionLogs } from '../actionLog.js'

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

async function closeAndReset() {
  const knex = sql.getKnex()
  if (knex && typeof knex.destroy !== 'function') sql.setKnex(null)
  await sql.close()
  reset()
}

describe('actionLog', () => {
  before(async () => {
    testDataDir = await fs.mkdtemp(path.join(import.meta.dirname, '.tmp-sqlite-actionlog-'))
    process.env.CLASSEMENTS_DATA_DIR = testDataDir
  })

  beforeEach(async () => {
    testDbPaths = []
    await closeAndReset()
  })

  afterEach(async () => {
    await closeAndReset()
    for (const dbPath of testDbPaths) await cleanupSqliteArtifacts(dbPath)
  })

  after(async () => {
    if (previousDataDir === undefined) delete process.env.CLASSEMENTS_DATA_DIR
    else process.env.CLASSEMENTS_DATA_DIR = previousDataDir
    if (testDataDir) await fs.rm(testDataDir, { recursive: true, force: true })
  })

  it('ne fait rien si aucune base n\'est ouverte', async () => {
    await logAction({ action: 'test', objectType: 'course' })
    // pas d'exception : c'est le seul comportement observable sans knex
  })

  it('enregistre une action avec ses donnees serialisees en JSON', async () => {
    await createTempDb('it-log-insert')

    await logAction({
      action: "Ajout d'un tour",
      objectType: 'tour',
      objectId: 42,
      equipe: 1,
      data: { transpondeur: 'TP-11', timestamp: 1000 },
    })

    const rows = await sql.getKnex().select('*').from('log')
    expect(rows).to.have.length(1)
    expect(rows[0]).to.include({
      action: "Ajout d'un tour",
      object_type: 'tour',
      object_id: '42',
      equipe: 1,
      elapsed: null,
    })
    expect(rows[0].timestamp).to.be.a('number')
    expect(JSON.parse(rows[0].data)).to.deep.equal({ transpondeur: 'TP-11', timestamp: 1000 })
  })

  it('stocke null quand data/objectId/equipe ne sont pas fournis', async () => {
    await createTempDb('it-log-defaults')

    await logAction({ action: 'Depart de la course', objectType: 'course' })

    const [row] = await sql.getKnex().select('*').from('log')
    expect(row).to.include({ object_id: null, equipe: null, data: null })
  })

  it('liste les actions du plus recent au plus ancien et permet de filtrer par equipe', async () => {
    await createTempDb('it-log-list')

    await logAction({ action: 'a1', objectType: 'tour', equipe: 1, data: { n: 1 } })
    await logAction({ action: 'a2', objectType: 'transpondeur', equipe: null, data: { n: 2 } })
    await logAction({ action: 'a3', objectType: 'equipe', equipe: 1, data: { n: 3 } })

    const all = await listActionLogs()
    expect(all.map(l => l.action)).to.deep.equal(['a3', 'a2', 'a1'])
    expect(all[0].data).to.deep.equal({ n: 3 })

    const forEquipe1 = await listActionLogs({ equipe: 1 })
    expect(forEquipe1.map(l => l.action)).to.deep.equal(['a3', 'a1'])

    const forEquipe1String = await listActionLogs({ equipe: '1' })
    expect(forEquipe1String.map(l => l.action)).to.deep.equal(['a3', 'a1'])
  })
})
