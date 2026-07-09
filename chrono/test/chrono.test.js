const { expect } = require('chai')
const { request } = require('undici')
const { WebSocket } = require('undici')
const { setTimeout: delay } = require('node:timers/promises')
const Knex = require('knex')
const _ = require('lodash')
const fs = require('node:fs')

// When running inside docker-compose, use service name `chrono`
const CHRONO_URL = 'http://chrono-dev:3000'
const SIM_URL = 'http://sim-dev:3000'
const CURRENT_DB_PATH = '/app/data/current.db'
const SESSION_BOOT_DELAY = 300


async function getSimStatus() {
  const res = await request(`${SIM_URL}/status`)
  return res.body.json()
}

async function post(url, options = {}) {
  const res = await request(url, { method: 'POST', ...options })
  expect(res.statusCode, `unexpected status ${res.statusCode} for POST ${url}`).to.equal(200)
  return res
}

async function startChrono() {
  await post(`${CHRONO_URL}/start`)
}

async function stopChrono() {
  await post(`${CHRONO_URL}/stop`)
}

async function connectSim() {
  await post(`${SIM_URL}/connect`)
}

async function disconnectSim() {
  await post(`${SIM_URL}/disconnect`)
}

async function startSession() {
  await startChrono()
  await delay(SESSION_BOOT_DELAY)
  await connectSim()
}

async function waitFor(check, options = {}) {
  const {
    timeout = 6000,
    interval = 100,
    label = 'condition'
  } = typeof options === 'number'
    ? { timeout: options }
    : options

  const start = Date.now()
  let lastError

  while (Date.now() - start < timeout) {
    try {
      const value = await check()
      if (value) return value
    } catch (err) {
      lastError = err
    }
    await delay(interval)
  }

  throw lastError || new Error(`timeout waiting for ${label}`)
}

async function waitForService(url, timeout = 30000) {
  await waitFor(async () => {
    const res = await request(url)
    if (res.statusCode >= 200 && res.statusCode < 500) return true
    throw new Error(`unexpected status ${res.statusCode} for ${url}`)
  }, {
    timeout,
    interval: 250,
    label: `service ${url}`
  })
}

async function queryDb(dbPath, query) {
  const db = Knex({
    client: 'sqlite3',
    connection: { filename: dbPath },
    useNullAsDefault: true
  })

  try {
    return await query(db)
  } finally {
    await db.destroy()
  }
}

async function addTourNow(transpondeur, timestamp) {
  await post(`${SIM_URL}/tours/add`, {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transpondeur, timestamp })
  })
}

async function addToursRaw(payload) {
  await post(`${SIM_URL}/tours/add`, {
    headers: { 'content-type': 'text/plain' },
    body: payload
  })
}

function getTranspondeurs(events) {
  return events
    .map(event => event.passage?.transpondeur || event.transpondeur)
    .filter(Boolean)
}

function triggerChronoRestartByWatch() {
  const watchedFile = '/app/app.js'
  const now = new Date()
  fs.utimesSync(watchedFile, now, now)
}

async function restartChronoByWatch({ from, timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const query = Number.isInteger(from) ? `?from=${from}` : ''
    const ws = new WebSocket(`ws://chrono-dev:3000/tours${query}`)
    let opened = false

    const timer = setTimeout(() => {
      reject(new Error('timeout waiting chrono websocket close after watch restart'))
    }, timeout)

    ws.onopen = () => {
      opened = true
      try {
        triggerChronoRestartByWatch()
      } catch (err) {
        clearTimeout(timer)
        reject(err)
      }
    }

    ws.onerror = (err) => {
      if (!opened) {
        clearTimeout(timer)
        reject(err)
      }
    }

    ws.onclose = () => {
      clearTimeout(timer)
      resolve()
    }
  })
}

// connect to chrono websocket and collect tour events
async function collectTours({ duration = 1500, from, onOpen } = {}) {
  return new Promise((resolve, reject) => {
    const query = Number.isInteger(from) ? `?from=${from}` : ''
    const ws = new WebSocket(`ws://chrono-dev:3000/tours${query}`)
    const events = []

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data)
        events.push(data)
      } catch (_) {}
    }

    ws.onerror = reject

    ws.onopen = async () => {
      if (onOpen) {
        try {
          await onOpen()
        } catch (err) {
          ws.close()
          reject(err)
          return
        }
      }

      setTimeout(() => {
        ws.close()
        resolve(events)
      }, duration)
    }
  })
}


describe('chrono functional - start/stop UDP (docker)', function () {
  this.timeout(30000)

  before(async () => {
    await waitForService(`${CHRONO_URL}/`)
    await waitForService(`${SIM_URL}/status`)
  })

  afterEach(async () => {
    try {
      await connectSim()
    } catch (_) {}

    try {
      await stopChrono()
    } catch (_) {}
  })

  it('should trigger START on simulator', async () => {
    await startChrono()

    await delay(500)

    const status = await getSimStatus()
    expect(status.status).to.equal('start')

    expect(fs.existsSync(CURRENT_DB_PATH), 'current.db does not exist after start').to.equal(true)
  })

  it('should trigger STOP on simulator', async () => {
    await startChrono()
    await stopChrono()

    await delay(500)

    const status = await getSimStatus()
    expect(status.status).to.equal('stop')
    expect(fs.existsSync(CURRENT_DB_PATH), 'current.db should be removed after stop').to.equal(false)
  })

  it('should send tours from sim to chrono (UDP flow active)', async () => {
    await startSession()

    // inject tours into simulator
    await addToursRaw('<STA 123 00:00\'01"000 99 01 3 1579>\n<STA 124 00:00\'02"000 99 01 3 1579>')

    const events = await collectTours({ duration: 1500 })

    expect(events, 'no tour events received on chrono websocket').to.have.length.greaterThan(0)

    await stopChrono()
  })

  it('should recover missed tours after disconnect (REPEAT)', async () => {
    const base = Date.now().toString()
    const before1 = `${base}01`
    const before2 = `${base}02`
    const missed1 = `${base}03`
    const missed2 = `${base}04`

    await startSession()

    await addTourNow(before1, 100)
    await addTourNow(before2, 200)

    expect(fs.existsSync(CURRENT_DB_PATH), 'current.db does not exist during REPEAT test').to.equal(true)
    const dbPath = fs.realpathSync(CURRENT_DB_PATH)

    const beforeRows = await waitFor(async () => {
      const rows = await queryDb(dbPath, knex => {
        return knex('passages')
          .select('id', 'transpondeur')
          .whereIn('transpondeur', [before1, before2])
          .orderBy('id', 'asc')
      })
      return rows.length >= 2 ? rows : null
    }, 8000)

    const fromId = beforeRows.reduce((max, row) => Math.max(max, row.id), 0)

    await disconnectSim()
    await addTourNow(missed1, 300)
    await addTourNow(missed2, 400)

    const afterEvents = await collectTours({
      from: fromId,
      duration: 1800,
      onOpen: async () => {
        await connectSim()
      }
    })

    const afterTranspondeurs = getTranspondeurs(afterEvents)

    expect(
      afterTranspondeurs,
      `no missed tours received after reconnect (REPEAT not working), got: ${JSON.stringify(afterTranspondeurs)}`
    ).to.include.members([missed1, missed2])
  })

  it('should persist all tours in sqlite without loss', async () => {
    await startSession()

    await addTourNow('301', 100)
    await addTourNow('302', 200)
    await addTourNow('303', 300)
    await addTourNow('304', 400)
    await addTourNow('305', 500)

    expect(fs.existsSync(CURRENT_DB_PATH), 'current.db does not exist during session').to.equal(true)
    const dbPath = fs.realpathSync(CURRENT_DB_PATH)

    await waitFor(async () => {
      const count = await queryDb(dbPath, async knex => {
        const [{ c }] = await knex('passages').count({ c: '*' })
        return Number(c)
      })
      return count >= 5
    }, 8000)

    // wait a bit to ensure sqlite flush
    await delay(500)

    const tableExists = await queryDb(dbPath, knex => {
      return knex.schema.hasTable('passages')
    })

    expect(tableExists, 'table passages does not exist').to.equal(true)

    const count = await queryDb(dbPath, async knex => {
      const [{ c }] = await knex('passages').count({ c: '*' })
      return Number(c)
    })

    expect(count, `expected at least 5 tours in db, got ${count}`).to.be.at.least(5)
  })

  it('should replay tours from querystring `from` and continue live stream', async () => {
    const base = (Date.now() + 1000).toString()
    const replayA = `${base}01`
    const replayB = `${base}02`
    const replayC = `${base}03`
    const replayD = `${base}04`
    const liveA = `${base}05`
    const liveB = `${base}06`

    await startSession()

    await addTourNow(replayA, 100)
    await addTourNow(replayB, 200)
    await addTourNow(replayC, 300)
    await addTourNow(replayD, 400)

    expect(fs.existsSync(CURRENT_DB_PATH), 'current.db does not exist during replay test').to.equal(true)
    const dbPath = fs.realpathSync(CURRENT_DB_PATH)

    const ids = await waitFor(async () => {
      const knownRows = await queryDb(dbPath, knex => {
        return knex('passages')
          .select('id', 'transpondeur')
          .whereIn('transpondeur', [replayA, replayB, replayC, replayD])
          .orderBy('id', 'asc')
      })
      const byTranspondeur = _.keyBy(knownRows, 'transpondeur')
      const map = {
        [replayA]: byTranspondeur[replayA]?.id,
        [replayB]: byTranspondeur[replayB]?.id,
        [replayC]: byTranspondeur[replayC]?.id,
        [replayD]: byTranspondeur[replayD]?.id
      }
      if (map[replayA] && map[replayB] && map[replayC] && map[replayD]) return map
      return null
    }, 8000)

    const orderedReplay = [replayA, replayB, replayC, replayD]
      .map(transpondeur => ({ transpondeur, id: ids[transpondeur] }))
      .sort((a, b) => a.id - b.id)
    const fromId = orderedReplay[1].id
    const expectedReplay = orderedReplay
      .filter(row => row.id > fromId)
      .map(row => row.transpondeur)
    const excludedReplay = orderedReplay
      .filter(row => row.id <= fromId)
      .map(row => row.transpondeur)

    const events = await collectTours({
      from: fromId,
      duration: 1800,
      onOpen: async () => {
        await delay(1200)
        await addTourNow(liveA, 1100)
        await addTourNow(liveB, 1200)
      }
    })

    const transpondeurs = getTranspondeurs(events)

    expect(
      transpondeurs,
      `expected replayed tours after from=${fromId}: ${JSON.stringify(expectedReplay)}, got: ${JSON.stringify(transpondeurs)}`
    ).to.include.members(expectedReplay)

    expect(
      transpondeurs,
      `expected live tours after websocket connection (${liveA},${liveB}), got: ${JSON.stringify(transpondeurs)}`
    ).to.include.members([liveA, liveB])

    expect(
      _.intersection(transpondeurs, excludedReplay),
      `expected tours at or before from=${fromId} to be excluded: ${JSON.stringify(excludedReplay)}, got: ${JSON.stringify(transpondeurs)}`
    ).to.have.lengthOf(0)

  })

  it('should keep current sqlite session and recover sim tours after chrono restart', async () => {
    const base = (Date.now() + 2000).toString()
    const beforeA = `${base}11`
    const beforeB = `${base}12`
    const pendingDuringCrash = `${base}13`

    await startSession()

    await addTourNow(beforeA, 100)
    await addTourNow(beforeB, 200)

    expect(fs.existsSync(CURRENT_DB_PATH), 'current.db does not exist before restart').to.equal(true)
    const dbPathBefore = fs.realpathSync(CURRENT_DB_PATH)

    const beforeRows = await waitFor(async () => {
      const rows = await queryDb(dbPathBefore, knex => {
        return knex('passages')
          .select('id', 'transpondeur')
          .whereIn('transpondeur', [beforeA, beforeB])
          .orderBy('id', 'asc')
      })
      return rows.length >= 2 ? rows : null
    }, 8000)

    const fromId = beforeRows.reduce((max, row) => Math.max(max, row.id), 0)

    await disconnectSim()
    await addTourNow(pendingDuringCrash, 300)
    await connectSim()

    await restartChronoByWatch({ from: fromId })

    await waitForService(`${CHRONO_URL}/`)

    const dbPathAfter = fs.realpathSync(CURRENT_DB_PATH)
    expect(
      dbPathAfter,
      `chrono should keep the same sqlite session after restart (before=${dbPathBefore}, after=${dbPathAfter})`
    ).to.equal(dbPathBefore)

    await waitFor(async () => {
      const rows = await queryDb(dbPathAfter, knex => {
        return knex('passages')
          .select('transpondeur')
          .whereIn('transpondeur', [beforeA, beforeB, pendingDuringCrash])
      })
      const set = new Set(rows.map(row => row.transpondeur))
      if (set.has(beforeA) && set.has(beforeB) && set.has(pendingDuringCrash)) return rows
      return null
    }, 12000)

    const replayEvents = await collectTours({ from: fromId, duration: 1500 })
    const replayTranspondeurs = getTranspondeurs(replayEvents)

    expect(
      replayTranspondeurs,
      `expected replay after restart to include pending tour (${pendingDuringCrash}), got: ${JSON.stringify(replayTranspondeurs)}`
    ).to.include(pendingDuringCrash)
  })
})
