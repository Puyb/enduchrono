const assert = require('assert')
const { request } = require('undici')
const { WebSocket } = require('undici')
const { setTimeout: delay } = require('node:timers/promises')
const sqlite3 = require('sqlite3')
const path = require('node:path')
const fs = require('node:fs')

// When running inside docker-compose, use service name `chrono`
const CHRONO_URL = 'http://chrono-dev:3000'
const SIM_URL = 'http://sim-dev:3000'


async function getSimStatus() {
  const res = await request(`${SIM_URL}/status`)
  return res.body.json()
}

// connect to chrono websocket and collect tour events
async function collectTours(duration = 1500) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://chrono-dev:3000/tours')
    const events = []

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data)
        events.push(data)
      } catch (_) {}
    }

    ws.onerror = reject

    ws.onopen = async () => {
      setTimeout(() => {
        ws.close()
        resolve(events)
      }, duration)
    }
  })
}


describe('chrono functional - start/stop UDP (docker)', function () {
  this.timeout(10000)

  // no manual wait: handled by docker healthcheck

  it('should trigger START on simulator', async () => {
    const res = await request(`${CHRONO_URL}/start`, { method: 'POST' })
    assert.equal(res.statusCode, 200)

    await delay(500)

    const status = await getSimStatus()
    assert.equal(status.status, 'start')

    const currentPath = '/app/data/current.db'
    assert(fs.existsSync(currentPath), 'current.db does not exist after start')
  })

  it('should trigger STOP on simulator', async () => {
    const res = await request(`${CHRONO_URL}/stop`, { method: 'POST' })
    assert.equal(res.statusCode, 200)

    await delay(500)

    const status = await getSimStatus()
    assert.equal(status.status, 'stop')
    const currentPath = '/app/data/current.db'
    assert(!fs.existsSync(currentPath), 'current.db should be removed after stop')
  })

  it('should send tours from sim to chrono (UDP flow active)', async () => {
    // start chrono
    await request(`${CHRONO_URL}/start`, { method: 'POST' })
    await delay(300)

    // ensure simulator is connected
    await request(`${SIM_URL}/connect`, { method: 'POST' })

    // inject tours into simulator
    await request(`${SIM_URL}/tours/add`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '<STA 123 00:00\'01"000 99 01 3 1579>\n<STA 124 00:00\'02"000 99 01 3 1579>'
    })

    const events = await collectTours(1500)

    assert(
      events.length > 0,
      'no tour events received on chrono websocket'
    )

    // stop chrono
    await request(`${CHRONO_URL}/stop`, { method: 'POST' })
  })

  it('should recover missed tours after disconnect (REPEAT)', async () => {
    // start session
    await request(`${CHRONO_URL}/start`, { method: 'POST' })
    await delay(300)

    // initial tours
    await request(`${SIM_URL}/tours/add`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '<STA 201 00:00\'01"000 99 01 3 1579>\n<STA 202 00:00\'02"000 99 01 3 1579>'
    })

    const beforeEvents = await collectTours(800)

    // simulate network cut
    await request(`${SIM_URL}/disconnect`, { method: 'POST' })

    // tours during outage
    await request(`${SIM_URL}/tours/add`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '<STA 203 00:00\'03"000 99 01 3 1579>\n<STA 204 00:00\'04"000 99 01 3 1579>'
    })

    await delay(500)

    // reconnect
    await request(`${SIM_URL}/connect`, { method: 'POST' })

    // allow REPEAT / resend
    const afterEvents = await collectTours(1200)

    assert(
      afterEvents.length > beforeEvents.length,
      'no additional tours received after reconnect (REPEAT not working)'
    )

    await request(`${CHRONO_URL}/stop`, { method: 'POST' })
  })

  it('should persist all tours in sqlite without loss', async () => {
    await request(`${CHRONO_URL}/start`, { method: 'POST' })
    await delay(300)

    await request(`${SIM_URL}/connect`, { method: 'POST' })

    // send 5 tours
    await request(`${SIM_URL}/tours/add`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: [
        '<STA 301 00:00\'00"100 99 01 3 1579>',
        '<STA 302 00:00\'00"200 99 01 3 1579>',
        '<STA 303 00:00\'00"300 99 01 3 1579>',
        '<STA 304 00:00\'00"400 99 01 3 1579>',
        '<STA 305 00:00\'00"500 99 01 3 1579>'
      ].join('\n')
    })

    await delay(2000)

    await request(`${CHRONO_URL}/stop`, { method: 'POST' })

    // find latest db file
    const dataDir = '/app/data'
    // db filename may vary, pick any recent file in data dir
    const files = fs.readdirSync(dataDir)
    assert(files.length > 0, 'no db file found in data dir')

    const latest = files
      .map(f => ({ f, t: fs.statSync(path.join(dataDir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)[0].f

    const dbPath = path.join(dataDir, latest)

    // wait a bit to ensure sqlite flush
    await delay(500)
    const db = new sqlite3.Database(dbPath)

    const tableExists = await new Promise((resolve, reject) => {
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='passages'", (err, row) => {
        if (err) return reject(err)
        resolve(!!row)
      })
    })

    assert(tableExists, 'table passages does not exist')

    const count = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as c FROM passages', (err, row) => {
        if (err) return reject(err)
        resolve(row.c)
      })
    })

    db.close()

    assert(
      count >= 5,
      `expected at least 5 tours in db, got ${count}`
    )
  })
})
