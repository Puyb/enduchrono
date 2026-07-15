/* global describe, it, beforeEach, afterEach */
import { expect } from 'chai'
import sinon from 'sinon'
import * as models from '../models.js'
import * as sql from '../sql.js'
import {
  reset,
  tours,
  equipes,
  equipiers,
  transpondeurs,
  categories,
  STATUS,
} from '../classes.js'

const { DUPLICATE_WINDOW_PERIOD, COURSE_DUREE, rankValue } = models

function createKnexMock() {
  const state = {
    inserts: [],
    updates: [],
    deletes: [],
    nextTourId: 1,
    course: [{ status: STATUS[0] }],
  }

  function knex(table) {
    const query = {
      _where: null,
      where(criteria) {
        this._where = criteria
        return this
      },
      async update(values) {
        state.updates.push({ table, where: this._where, values })
        if (table === 'course' && 'status' in values) {
          state.course[0].status = values.status
        }
        return 1
      },
      async delete() {
        state.deletes.push({ table, where: this._where })
        return 1
      },
    }
    return query
  }

  knex.insert = row => ({
    into(table) {
      state.inserts.push({ table, row: { ...row } })
      if (table === 'tours') {
        return Promise.resolve([state.nextTourId++])
      }
      const conflictQuery = {
        onConflict() {
          return conflictQuery
        },
        async merge() {
          return 1
        },
      }
      return conflictQuery
    },
  })

  knex.select = () => ({
    from: async table => state[table] || [],
  })

  return { knex, state }
}

function registerEquipe({ equipeId, dossard, categorie = 'A', penalite = 0 }) {
  const equipe = {
    equipe: equipeId,
    categorie,
    penalite,
    tours: [],
    temps: null,
    _has_changed: false,
  }
  const equipier = { dossard, equipe: equipeId, transpondeurs: [] }
  equipes[equipeId] = equipe
  equipiers[dossard] = equipier
  categories.general.push(equipe)
  categories[categorie] = categories[categorie] || []
  categories[categorie].push(equipe)
  return { equipe, equipier }
}

function registerTranspondeur(id, dossard) {
  const transpondeur = { id, dossard, deleted: false }
  transpondeurs[id] = transpondeur
  if (equipiers[dossard]) {
    equipiers[dossard].transpondeurs.push(transpondeur)
  }
  return transpondeur
}

function createTour({ id, numero = id, dossard, timestamp, status = null, transpondeur = `T-${dossard}` }) {
  return { id, numero, dossard, transpondeur, timestamp, source: 'chrono', status }
}

function refreshClassements() {
  for (const equipe of Object.values(equipes)) {
    if (!equipe.tours.length) continue
    equipe._rank = rankValue(equipe)
    equipe.temps = equipe.tours[equipe.tours.length - 1].timestamp
  }
  models.calculClassements()
  for (const equipe of Object.values(equipes)) {
    equipe._has_changed = false
  }
}

describe('models business behavior', () => {
  let db
  let emitStub

  async function setStatus(status) {
    await models.changeStatus(status)
    db.state.updates.length = 0
    emitStub.resetHistory()
  }

  beforeEach(async () => {
    reset()
    db = createKnexMock()
    sql.setKnex(db.knex)
    emitStub = sinon.stub(models.events, 'emit').resolves()
    sinon.stub(console, 'log') // to prevent tests from emiting console.log
    await models.changeStatus(STATUS[0])
    db.state.updates.length = 0
    emitStub.resetHistory()
  })

  afterEach(() => {
    sinon.restore()
    sql.setKnex(null)
    reset()
  })

  describe('addTour', () => {
    it('sets status to ignore during TEST and DEPART phases', async () => {
      const { equipe } = registerEquipe({ equipeId: 1, dossard: 11 })
      registerTranspondeur('TP-11', 11)

      await setStatus('TEST')
      await models.addTour({ id: 1, transpondeur: 'TP-11', timestamp: 1000 })
      await setStatus('DEPART')
      await models.addTour({ id: 2, transpondeur: 'TP-11', timestamp: 2000 })

      expect(tours).to.have.length(2)
      expect(tours.map(t => t.status)).to.deep.equal(['ignore', 'ignore'])
      expect(equipe.tours).to.have.length(0)
    })

    it('processes laps normally during COURSE and FIN phases', async () => {
      const { equipe } = registerEquipe({ equipeId: 1, dossard: 11 })
      registerTranspondeur('TP-11', 11)

      await setStatus('COURSE')
      await models.addTour({ id: 1, transpondeur: 'TP-11', timestamp: 1000 })
      await setStatus('FIN')
      await models.addTour({ id: 2, transpondeur: 'TP-11', timestamp: 200000 })

      expect(tours).to.have.length(2)
      expect(tours.map(t => t.status)).to.deep.equal([null, null])
      expect(equipe.tours.map(t => t.numero)).to.deep.equal([1, 2])
    })

    it('creates an unknown transpondeur and stores a lap with null dossard', async () => {
      await setStatus('COURSE')

      await models.addTour({ id: 10, transpondeur: 'UNKNOWN', timestamp: 12345 })

      expect(transpondeurs.UNKNOWN).to.deep.equal({ id: 'UNKNOWN', dossard: null, deleted: false })
      expect(tours).to.have.length(1)
      expect(tours[0]).to.include({ numero: 10, transpondeur: 'UNKNOWN', dossard: null, status: null })
      expect(db.state.inserts.map(i => i.table)).to.include.members(['transpondeurs', 'tours'])
    })

    it('detects duplicates with the 2-minute window and the 6h rule', async () => {
      const { equipe } = registerEquipe({ equipeId: 1, dossard: 11 })
      registerTranspondeur('TP-11', 11)
      await setStatus('COURSE')

      await models.addTour({ id: 1, transpondeur: 'TP-11', timestamp: 1000 })
      await models.addTour({ id: 2, transpondeur: 'TP-11', timestamp: 1000 + DUPLICATE_WINDOW_PERIOD - 1 })
      await models.addTour({ id: 3, transpondeur: 'TP-11', timestamp: COURSE_DUREE + 10 })
      await models.addTour({ id: 4, transpondeur: 'TP-11', timestamp: COURSE_DUREE + 11 })

      expect(tours.find(t => t.numero === 2).status).to.equal('duplicate')
      expect(tours.find(t => t.numero === 4).status).to.equal('duplicate')
      expect(equipe.tours.map(t => t.numero)).to.deep.equal([1, 3])
    })

    it('flags one of two near-simultaneous laps from a skater wearing two transponders as duplicate', async () => {
      const { equipe } = registerEquipe({ equipeId: 1, dossard: 11 })
      registerTranspondeur('TP-11a', 11)
      registerTranspondeur('TP-11b', 11)
      await setStatus('COURSE')

      await Promise.all([
        models.addTour({ id: 1, transpondeur: 'TP-11a', timestamp: 1000 }),
        models.addTour({ id: 2, transpondeur: 'TP-11b', timestamp: 1001 }),
      ])

      expect(tours.map(t => t.status).sort()).to.deep.equal(['duplicate', null])
      expect(equipe.tours).to.have.length(1)
    })

    it('inserts delayed events in chronological order', async () => {
      const { equipe } = registerEquipe({ equipeId: 1, dossard: 11 })
      registerTranspondeur('TP-11', 11)
      await setStatus('COURSE')

      await models.addTour({ id: 1, transpondeur: 'TP-11', timestamp: 2000 })
      await models.addTour({ id: 2, transpondeur: 'TP-11', timestamp: 1500 })

      expect(tours.map(t => t.numero)).to.deep.equal([2, 1])
      expect(equipe.tours.map(t => t.timestamp)).to.deep.equal([1500, 2000])
    })
  })

  describe('modifTour', () => {
    function setupTwoTeams() {
      const { equipe: team1 } = registerEquipe({ equipeId: 1, dossard: 11, categorie: 'A' })
      const { equipe: team2 } = registerEquipe({ equipeId: 2, dossard: 21, categorie: 'A' })

      const t1a = createTour({ id: 101, dossard: 11, timestamp: 1000 })
      const t2a = createTour({ id: 201, dossard: 21, timestamp: 1500 })
      const t1b = createTour({ id: 102, dossard: 11, timestamp: 2000 })
      const t2b = createTour({ id: 202, dossard: 21, timestamp: 2500 })

      tours.push(t1a, t2a, t1b, t2b)
      team1.tours.push(t1a, t1b)
      team2.tours.push(t2a, t2b)

      refreshClassements()
      return { team1, team2, t1a, t1b }
    }

    it('removes a valid lap from equipe and recalculates ranking', async () => {
      const { team1, team2, t1b } = setupTwoTeams()

      await models.modifTour(t1b.id, true)

      expect(t1b).to.have.a.property('status', 'deleted')
      expect(team1.tours.map(t => t.id)).to.deep.equal([101])
      expect(team1).to.have.a.property('temps', 1000)
      expect(categories.general[0]).to.equal(team2)
      expect(db.state.updates).to.deep.include({
        table: 'tours',
        where: { id: t1b.id },
        values: { status: 'deleted' },
      })
    })

    it('restores a deleted lap, reinserts it, and recalculates ranking', async () => {
      const { team1, t1a, t1b } = setupTwoTeams()
      t1b.status = 'deleted'
      team1.tours = [t1a]
      refreshClassements()

      await models.modifTour(t1b.id, false)

      expect(t1b).to.have.a.property('status', null)
      expect(team1.tours.map(t => t.id)).to.deep.equal([101, 102])
      expect(team1).to.have.a.property('temps', 2000)
      expect(categories.general[0]).to.equal(team1)
      expect(db.state.updates).to.deep.include({
        table: 'tours',
        where: { id: t1b.id },
        values: { status: null },
      })
    })

    it('ignores forbidden transitions without DB updates', async () => {
      const { equipe: team } = registerEquipe({ equipeId: 1, dossard: 11, categorie: 'A' })
      const ignored = createTour({ id: 1, dossard: 11, timestamp: 1000, status: 'ignore' })
      const deleted = createTour({ id: 2, dossard: 11, timestamp: 1100, status: 'deleted' })
      const active = createTour({ id: 3, dossard: 11, timestamp: 1200, status: null })
      tours.push(ignored, deleted, active)
      team.tours.push(active)
      refreshClassements()
      db.state.updates.length = 0

      await models.modifTour(ignored.id, true)
      await models.modifTour(deleted.id, true)
      await models.modifTour(active.id, false)

      expect(ignored).to.have.a.property('status', 'ignore')
      expect(deleted).to.have.a.property('status', 'deleted')
      expect(active).to.have.a.property('status', null)
      expect(team.tours.map(t => t.id)).to.deep.equal([3])
      expect(db.state.updates).to.have.length(0)
    })
  })

  describe('modifEquipe', () => {
    it('recalculates rank and positions when penalty changes', async () => {
      const { equipe: team1 } = registerEquipe({ equipeId: 1, dossard: 11, categorie: 'A', penalite: 0 })
      const { equipe: team2 } = registerEquipe({ equipeId: 2, dossard: 21, categorie: 'A', penalite: 0 })

      team1.tours.push(createTour({ id: 1, dossard: 11, timestamp: 1000 }), createTour({ id: 2, dossard: 11, timestamp: 2000 }))
      team2.tours.push(createTour({ id: 3, dossard: 21, timestamp: 1500 }), createTour({ id: 4, dossard: 21, timestamp: 2500 }))
      refreshClassements()
      expect(categories.general[0]).to.equal(team1)

      await models.modifEquipe(1, { penalite: -1 })

      expect(team1).to.have.a.property('penalite', -1)
      expect(team1).to.have.a.property('_rank', rankValue(team1))
      expect(categories.general[0]).to.equal(team2)
      expect(db.state.updates).to.deep.include({
        table: 'equipes',
        where: { equipe: 1 },
        values: { penalite: -1 },
      })
    })

    it('moves a team between categories and updates category positions', async () => {
      const { equipe: team1 } = registerEquipe({ equipeId: 1, dossard: 11, categorie: 'A' })
      const { equipe: team2 } = registerEquipe({ equipeId: 2, dossard: 21, categorie: 'A' })
      const { equipe: team3 } = registerEquipe({ equipeId: 3, dossard: 31, categorie: 'B' })

      team1.tours.push(createTour({ id: 1, dossard: 11, timestamp: 1000 }), createTour({ id: 2, dossard: 11, timestamp: 2000 }))
      team2.tours.push(createTour({ id: 3, dossard: 21, timestamp: 1500 }))
      team3.tours.push(createTour({ id: 4, dossard: 31, timestamp: 3000 }))
      refreshClassements()

      await models.modifEquipe(1, { categorie: 'B' })

      expect(team1).to.have.a.property('categorie', 'B')
      expect(categories.A.map(team => team.equipe)).to.deep.equal([2])
      expect(categories.B.map(team => team.equipe)).to.include.members([1, 3])
      expect(team2).to.have.a.property('position_categorie', 1)
      expect(team1).to.have.a.property('position_categorie', 1)
      expect(db.state.updates).to.deep.include({
        table: 'equipes',
        where: { equipe: 1 },
        values: { categorie: 'B' },
      })
    })
  })

  describe('syncStatus', () => {
    it('does not change status when statusLock is active', async () => {
      await setStatus('DEPART')
      models.lockStatus()

      await models.syncStatus('start')

      expect(db.state.updates).to.have.length(0)
      expect(emitStub).to.have.a.property('callCount', 0)
    })

    it('maps chrono start/stop to expected transitions', async () => {
      await setStatus('DEPART')
      await models.syncStatus('start')
      expect(db.state.updates.map(update => update.values.status)).to.deep.equal(['TEST'])

      await setStatus('TEST')
      await models.syncStatus('stop')
      expect(db.state.updates.map(update => update.values.status)).to.deep.equal(['DEPART'])

      await setStatus('COURSE')
      await models.syncStatus('stop')
      expect(db.state.updates.map(update => update.values.status)).to.deep.equal(['FIN'])
    })
  })

  describe('getLastTourNumero', () => {
    it('returns last numero in TEST only when latest tour is ignored', async () => {
      await setStatus('TEST')
      tours.push(createTour({ id: 1, numero: 21, dossard: null, timestamp: 1000, status: 'ignore' }))
      expect(models.getLastTourNumero()).to.equal(21)

      tours.push(createTour({ id: 2, numero: 22, dossard: null, timestamp: 1100, status: null }))
      expect(models.getLastTourNumero()).to.equal(null)
    })

    it('returns last numero outside TEST only when latest tour is not ignored', async () => {
      await setStatus('COURSE')
      tours.push(createTour({ id: 1, numero: 31, dossard: null, timestamp: 1000, status: null }))
      expect(models.getLastTourNumero()).to.equal(31)

      tours.push(createTour({ id: 2, numero: 32, dossard: null, timestamp: 1100, status: 'ignore' }))
      expect(models.getLastTourNumero()).to.equal(null)
    })

    it('returns null when there is no lap', async () => {
      await setStatus('FIN')
      expect(models.getLastTourNumero()).to.equal(null)
    })
  })

  describe('notifyAndGetHasChanged', () => {
    it('notifies only teams marked as changed', async () => {
      equipes[1] = { equipe: 1, _has_changed: true }
      equipes[2] = { equipe: 2, _has_changed: false }
      equipes[3] = { equipe: 3, _has_changed: true }
      const callback = sinon.stub().resolves()

      const changed = await models.notifyAndGetHasChanged(callback)

      expect(callback).to.have.a.property('callCount', 2)
      expect(changed.map(team => team.equipe)).to.have.members([1, 3])
      expect(equipes[1]).to.have.a.property('_has_changed', false)
      expect(equipes[2]).to.have.a.property('_has_changed', false)
      expect(equipes[3]).to.have.a.property('_has_changed', false)
    })
  })
})
