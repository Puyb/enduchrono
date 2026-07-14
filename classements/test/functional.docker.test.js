/* global describe, it, before, beforeEach, afterEach */
import { expect } from 'chai'
import { WebSocketClient } from '@culpeo/async-ws'
import { asyncDrop, asyncFilter, asyncFlatMap, asyncMap, asyncTake, arrayFromAsync, asyncEnumerate, execPipe } from 'iter-tools'
import { setTimeout as delay } from 'node:timers/promises'

const CLASSEMENTS_URL = process.env.CLASSEMENTS_URL || 'http://classements-dev:3000'
const CHRONO_URL = process.env.CHRONO_URL || 'http://chrono-dev:3000'
const SIM_URL = process.env.SIM_URL || 'http://sim-dev:3000'
const CONTROL_WS_URL = CLASSEMENTS_URL.replace(/^http/, 'ws') + '/websockets/control'

const DUPLICATE_WINDOW_PERIOD = 2 * 60 * 1000
const COURSE_DUREE = 6 * 3600 * 1000

const promiseTimeout = async (prom, timeout, label = 'operation') => {
  const ac = new AbortController()
  const value = await Promise.race([
    prom,
    delay(timeout, undefined, ac).then(() => { throw new Error(`timeout waiting for ${label}`); })
  ])
  ac.abort();
  return value;
}

async function waitFor(check, options = {}) {
  const {
    timeout = 8000,
    interval = 100,
    label = 'condition',
  } = typeof options === 'number' ? { timeout: options } : options

  const start = Date.now()

  while (Date.now() - start < timeout) {
    const value = await check()
    if (value) return value
    await delay(interval)
  }

  throw new Error(`timeout waiting for ${label}`)
}

async function waitForService(url, timeout = 45000) {
  await waitFor(async () => {
    const res = await fetch(url)
    if (res.status >= 200 && res.status < 500) return true
    throw new Error(`unexpected status ${res.status} for ${url}`)
  }, {
    timeout,
    interval: 250,
    label: `service ${url}`,
  })
}

async function requestJson(url, { method = 'GET', expectedStatus = 200, body, headers } = {}) {
  const requestHeaders = { ...(headers || {}) }
  const options = { method, headers: requestHeaders }
  if (body !== undefined) {
    requestHeaders['content-type'] = 'application/json'
    options.body = JSON.stringify(body)
  }

  const res = await fetch(url, options)
  expect(res, `unexpected status ${res.status} for ${method} ${url}`).to.have.a.property('status', expectedStatus)

  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new Error(`invalid JSON response for ${method} ${url}: ${err.message}`)
  }
}

async function postJson(url, body, options = {}) {
  return requestJson(url, { method: 'POST', body, ...options })
}

async function deleteJson(url, options = {}) {
  return requestJson(url, { method: 'DELETE', ...options })
}

async function safePost(url, body) {
  try {
    await postJson(url, body)
  } catch (_) {}
}

async function getEquipes() {
  const payload = await requestJson(`${CLASSEMENTS_URL}/equipes`)
  return payload.equipes || {}
}

async function getCategories() {
  const payload = await requestJson(`${CLASSEMENTS_URL}/categories`)
  return payload.categories || {}
}

async function getSimStatus() {
  return requestJson(`${SIM_URL}/status`)
}

function makeImportFixture(seedLabel) {
  const seed = `${Date.now()}${Math.floor(Math.random() * 1000)}`.replace(/\D/g, '').slice(-12)
  const transpondeur1 = `${seed}11`
  const transpondeur2 = `${seed}21`

  return {
    courseName: `functional_${seedLabel}_${seed}`,
    team1: { equipe: 1, dossard: 11, transpondeur: transpondeur1, categorie: 'A' },
    team2: { equipe: 2, dossard: 21, transpondeur: transpondeur2, categorie: 'B' },
    equipesCsv: [
      'equipe,nom,categorie,penalite,deleted',
      '1,Equipe 1,A,0,0',
      '2,Equipe 2,B,0,0',
    ].join('\n'),
    equipiersCsv: [
      'equipe,dossard,nom,prenom,deleted',
      '1,11,Nom11,Prenom11,0',
      '2,21,Nom21,Prenom21,0',
    ].join('\n'),
    transpondeursCsv: [
      'id,dossard,deleted,vu,battery',
      `${transpondeur1},11,0,0,`,
      `${transpondeur2},21,0,0,`,
    ].join('\n'),
  }
}

async function importCourse(fixture) {
  const form = new FormData()
  form.set('name', fixture.courseName)
  form.set('equipes', new Blob([fixture.equipesCsv], { type: 'text/csv' }), 'equipes.csv')
  form.set('equipiers', new Blob([fixture.equipiersCsv], { type: 'text/csv' }), 'equipiers.csv')
  form.set('transpondeurs', new Blob([fixture.transpondeursCsv], { type: 'text/csv' }), 'transpondeurs.csv')

  const response = await fetch(`${CLASSEMENTS_URL}/import`, {
    method: 'POST',
    body: form,
    headers: { referer: `${CLASSEMENTS_URL}/` },
    redirect: 'manual',
  })

  expect(response.status, `unexpected status ${response.status} for POST /import`).to.be.oneOf([302, 303])
}

async function addManualTour({ id, transpondeur, dossard, timestamp, source = 'manual' }) {
  await postJson(`${CLASSEMENTS_URL}/tour`, {
    id,
    transpondeur,
    dossard,
    timestamp,
    source,
  })
}

function extractUpdateEvents(message) {
  if (message.event !== 'update' || !Array.isArray(message.events)) return []
  return message.events
}

const WS_CONNECT_TIMEOUT = 10000
const WS_MESSAGE_TIMEOUT = 10000
const WS_SEARCH_LIMIT = 200

async function createControlWsClient({ topics } = {}) {
  const query = topics?.length ? `?topics=${topics.join(',')}` : ''
  const wsUrl = `${CONTROL_WS_URL}${query}`
  const client = new WebSocketClient({ maxBufferSize: 1000 })
  await client.connect(wsUrl, { timeout: WS_CONNECT_TIMEOUT })

  const stream = execPipe(
    client,
    asyncEnumerate(0),
    asyncMap(([index, message]) => ({ index, message: JSON.parse(message.data) })),
    asyncTake(WS_SEARCH_LIMIT)
  )

  const waitForMessage = async (predicate, { skip = 0, timeout = WS_MESSAGE_TIMEOUT, label = 'message' } = {}) => {
    const found = await promiseTimeout(
      arrayFromAsync(execPipe(
        stream,
        asyncDrop(skip),
        asyncFilter(({ message, index }) => predicate(message, index)),
        asyncTake(1),
      )),
      timeout,
      label,
    )
    if (!found.length) throw new Error('no matching websocket message found')
    return found[0]
  }

  const waitForTour = async (matcher, { skip = 0, timeout = WS_MESSAGE_TIMEOUT, label = 'tour' } = {}) => {
    const found = await promiseTimeout(
      arrayFromAsync(execPipe(
        stream,
        asyncDrop(skip),
        asyncFlatMap(({ message, index }) => {
          return extractUpdateEvents(message)
            .filter(event => event.event === 'tour')
            .map(event => ({ tour: event.tour, event, index, message }))
        }),
        asyncFilter(({ tour, event, index, message }) => matcher(tour, event, index, message)),
        asyncTake(1),
      )),
      timeout,
      label,
    )
    if (!found.length) throw new Error('no matching websocket tour found')
    return found[0]
  }

  const waitForAllMessages = async (predicates, { maxMessages = WS_SEARCH_LIMIT, timeout = WS_MESSAGE_TIMEOUT, label = 'messages' } = {}) => {
    const found = await promiseTimeout(
      arrayFromAsync(execPipe(
        stream,
        asyncTake(maxMessages),
        asyncFilter(entry => predicates.some(predicate => predicate(entry.message, entry.index))),
        asyncTake(predicates.length),
      )),
      timeout,
      label,
    )
    expect(found).to.have.a.lengthOf(predicates.length)
    return found
  }

  const expectNoMessage = async (predicate, options = {}) => {
    const {
      timeout = 1500,
      maxMessages = 5,
      label = 'unexpected websocket message',
    } = options

    try {
      const found = await waitForMessage(predicate, { timeout, maxMessages, label })
      throw new Error(`${label}: ${JSON.stringify(found.message)}`)
    } catch (err) {
      if (!String(err.message || '').startsWith('timeout waiting for')) throw err
    }
  }

  return {
    waitForMessage,
    waitForTour,
    waitForAllMessages,
    expectNoMessage,
    async close() {
      await client.close()
    },
  }
}

async function waitForCourseSnapshot(wsClient, courseName) {
  return wsClient.waitForMessage(
    msg => msg.event === 'init' && msg.course?.name === courseName,
    {
      timeout: 12000,
      label: `init snapshot for ${courseName}`,
    },
  )
}

async function waitForTeamTours(teamId, expectedLength) {
  return waitFor(async () => {
    const equipes = await getEquipes()
    const team = equipes[String(teamId)]
    return team && (team.tours || []).length >= expectedLength && team
  }, {
    timeout: WS_MESSAGE_TIMEOUT,
    interval: 100,
    label: `team ${teamId} tours >= ${expectedLength}`,
  })
}

describe('classements functional (docker stack)', function () {
  this.timeout(90000)

  const wsClients = []

  async function openWs(options = {}) {
    const client = await createControlWsClient(options)
    wsClients.push(client)
    return client
  }

  before(async () => {
    await waitForService(`${CLASSEMENTS_URL}/`)
    await waitForService(`${CHRONO_URL}/`)
    await waitForService(`${SIM_URL}/status`)
  })

  beforeEach(async () => {
    await safePost(`${CLASSEMENTS_URL}/course/close`)
    await safePost(`${CHRONO_URL}/stop`)
    await safePost(`${SIM_URL}/connect`)
  })

  afterEach(async () => {
    while (wsClients.length) {
      const client = wsClients.pop()
      await client.close()
    }
    await safePost(`${CLASSEMENTS_URL}/course/close`)
    await safePost(`${CHRONO_URL}/stop`)
    await safePost(`${SIM_URL}/connect`)
  })

  it('covers import + TEST status + coherent init on control websocket', async () => {
    const ws = await openWs()
    const fixture = makeImportFixture('import')

    await importCourse(fixture)

    const { message: init } = await waitForCourseSnapshot(ws, fixture.courseName)

    expect(init.course).to.include({ name: fixture.courseName, status: 'TEST' })
    expect(Object.keys(init.equipes || {})).to.have.members(['1', '2'])
    expect(init.transpondeurs || []).to.have.length(2)
    expect(init.categories || []).to.have.members(['A', 'B'])
    expect(init.equipes['1']).to.have.property('tours', 0)
    expect(init.equipes['2']).to.have.property('tours', 0)
  })

  it('covers status cycle endpoints and coherence with chrono/sim status', async () => {
    const ws = await openWs({ topics: ['course', 'status', 'open'] })
    const fixture = makeImportFixture('status_cycle')

    await importCourse(fixture)
    await waitForCourseSnapshot(ws, fixture.courseName)

    const expectTransition = async ({ endpoint, courseStatus, chronoStatus, simStatus }) => {
      await postJson(`${CLASSEMENTS_URL}${endpoint}`)

      await ws.waitForAllMessages([
        msg => msg.event === 'course' && msg.course?.status === courseStatus,
        msg => msg.event === 'status' && msg.status?.status === chronoStatus,
      ], {
        label: `course/status transition ${courseStatus}/${chronoStatus}`,
        maxMessages: 30,
      })

      await waitFor(async () => {
        const status = await getSimStatus()
        return status.status === simStatus
      }, {
        timeout: 6000,
        interval: 100,
        label: `sim status ${simStatus}`,
      })
    }

    await expectTransition({ endpoint: '/test/start', courseStatus: 'TEST', chronoStatus: 'start', simStatus: 'start' })
    await expectTransition({ endpoint: '/test/stop', courseStatus: 'DEPART', chronoStatus: 'stop', simStatus: 'stop' })
    await expectTransition({ endpoint: '/course/start', courseStatus: 'COURSE', chronoStatus: 'start', simStatus: 'start' })
    await expectTransition({ endpoint: '/course/stop', courseStatus: 'FIN', chronoStatus: 'stop', simStatus: 'stop' })
  })

  it('covers lap handling by race state: ignore in TEST/DEPART, valid in COURSE/FIN', async () => {
    const ws = await openWs()
    const fixture = makeImportFixture('state_laps')

    await importCourse(fixture)
    await waitForCourseSnapshot(ws, fixture.courseName)

    await addManualTour({ id: 1001, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: 1000 })
    await ws.waitForTour(
      tour => tour.timestamp === 1000 && tour.status === 'ignore',
      { label: 'ignore in TEST' },
    )

    await postJson(`${CLASSEMENTS_URL}/test/stop`)
    await ws.waitForMessage(
      msg => msg.event === 'course' && msg.course?.status === 'DEPART',
      { label: 'status DEPART' },
    )

    await addManualTour({ id: 1002, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: 2000 })
    await ws.waitForTour(
      tour => tour.timestamp === 2000 && tour.status === 'ignore',
      { label: 'ignore in DEPART' },
    )

    await postJson(`${CLASSEMENTS_URL}/course/start`)
    await ws.waitForMessage(
      msg => msg.event === 'course' && msg.course?.status === 'COURSE',
      { label: 'status COURSE' },
    )

    await addManualTour({ id: 1003, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: 130000 })
    await ws.waitForTour(
      tour => tour.timestamp === 130000 && tour.status === null,
      { label: 'valid in COURSE' },
    )

    await postJson(`${CLASSEMENTS_URL}/course/stop`)
    await ws.waitForMessage(
      msg => msg.event === 'course' && msg.course?.status === 'FIN',
      { label: 'status FIN' },
    )

    await addManualTour({ id: 1004, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: 260000 })
    await ws.waitForTour(
      tour => tour.timestamp === 260000 && tour.status === null,
      { label: 'valid in FIN' },
    )

    const team1 = await waitForTeamTours(1, 2)
    expect(team1.tours.map(tour => tour.timestamp)).to.deep.equal([130000, 260000])
  })

  it('covers duplicate detection (2 min window + 6h rule)', async () => {
    const ws = await openWs()
    const fixture = makeImportFixture('duplicates')

    await importCourse(fixture)
    await waitForCourseSnapshot(ws, fixture.courseName)

    await postJson(`${CLASSEMENTS_URL}/course/start`)
    await ws.waitForMessage(
      msg => msg.event === 'course' && msg.course?.status === 'COURSE',
      { label: 'status COURSE before duplicates' },
    )

    const t1 = 1000
    const t2 = t1 + DUPLICATE_WINDOW_PERIOD - 1
    const t3 = COURSE_DUREE + 10
    const t4 = COURSE_DUREE + 11

    await addManualTour({ id: 2001, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: t1 })
    await ws.waitForTour(
      tour => tour.timestamp === t1 && tour.status === null,
      { label: 'first valid lap' },
    )

    await addManualTour({ id: 2002, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: t2 })
    await ws.waitForTour(
      tour => tour.timestamp === t2 && tour.status === 'duplicate',
      { label: '2 minute duplicate' },
    )

    await addManualTour({ id: 2003, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: t3 })
    await ws.waitForTour(
      tour => tour.timestamp === t3 && tour.status === null,
      { label: 'first lap over 6h' },
    )

    await addManualTour({ id: 2004, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: t4 })
    await ws.waitForTour(
      tour => tour.timestamp === t4 && tour.status === 'duplicate',
      { label: '6h guard duplicate' },
    )

    const team1 = await waitForTeamTours(1, 2)
    expect(team1.tours.map(tour => tour.timestamp)).to.deep.equal([t1, t3])
  })

  it('covers manual corrections (/tour, /tour/:id, /equipe/:id) and ranking impact', async () => {
    const ws = await openWs()
    const fixture = makeImportFixture('manual_corrections')

    await importCourse(fixture)
    await waitForCourseSnapshot(ws, fixture.courseName)

    await postJson(`${CLASSEMENTS_URL}/course/start`)
    await ws.waitForMessage(
      msg => msg.event === 'course' && msg.course?.status === 'COURSE',
      { label: 'status COURSE before corrections' },
    )

    await addManualTour({ id: 3001, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: 100000 })
    await addManualTour({ id: 3002, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: 220000 })
    await addManualTour({ id: 3003, transpondeur: fixture.team2.transpondeur, dossard: fixture.team2.dossard, timestamp: 50000 })

    await waitFor(async () => {
      const equipes = await getEquipes()
      const team1 = equipes['1']
      const team2 = equipes['2']
      return Boolean(team1 && team2 && team1.position_general === 1 && team2.position_general === 2 && team1.tours.length === 2 && team2.tours.length === 1)
    }, {
      timeout: 10000,
      interval: 100,
      label: 'initial ranking before corrections',
    })

    let equipes = await getEquipes()
    const deletedLapId = equipes['1'].tours[1].id

    await deleteJson(`${CLASSEMENTS_URL}/tour/${deletedLapId}`)
    await waitFor(async () => {
      const state = await getEquipes()
      return state['1'].tours.length === 1 && state['2'].position_general === 1
    }, {
      timeout: 10000,
      interval: 100,
      label: 'ranking after deleting team1 lap',
    })

    await postJson(`${CLASSEMENTS_URL}/tour/${deletedLapId}`, { status: false })
    await waitFor(async () => {
      const state = await getEquipes()
      return state['1'].tours.length === 2 && state['1'].position_general === 1
    }, {
      timeout: 10000,
      interval: 100,
      label: 'ranking after restoring team1 lap',
    })

    await addManualTour({ id: 3004, transpondeur: fixture.team2.transpondeur, dossard: fixture.team2.dossard, timestamp: 300000 })
    await waitForTeamTours(2, 2)

    await postJson(`${CLASSEMENTS_URL}/equipe/1`, { penalite: -1 })
    await waitFor(async () => {
      const state = await getEquipes()
      return state['2'].position_general === 1 && state['1'].position_general === 2
    }, {
      timeout: 10000,
      interval: 100,
      label: 'ranking after penalty',
    })

    await postJson(`${CLASSEMENTS_URL}/equipe/1`, { categorie: 'B' })
    const categories = await waitFor(async () => {
      const state = await getCategories()
      const categoryA = state.A || []
      const categoryB = state.B || []
      const inA = categoryA.some(equipe => equipe.equipe === 1)
      const inB = categoryB.some(equipe => equipe.equipe === 1)
      return !inA && inB && state
    }, {
      timeout: 10000,
      interval: 100,
      label: 'category move after /equipe/:id',
    })

    expect((categories.A || []).map(equipe => equipe.equipe)).to.not.include(1)
    expect((categories.B || []).map(equipe => equipe.equipe)).to.include.members([1, 2])
  })

  it('covers websocket control: init, update batch, topics filtering and status stream', async () => {
    const wsAll = await openWs()
    const wsFiltered = await openWs({ topics: ['course', 'status', 'connection', 'open'] })
    const fixture = makeImportFixture('ws_control')

    await importCourse(fixture)

    const { message: fullInit } = await waitForCourseSnapshot(wsAll, fixture.courseName)
    const { message: filteredInit } = await waitForCourseSnapshot(wsFiltered, fixture.courseName)

    expect(fullInit).to.have.property('equipes')
    expect(fullInit).to.have.property('tours')
    expect(filteredInit).to.have.property('course')
    expect(filteredInit).to.not.have.property('equipes')
    expect(filteredInit).to.not.have.property('tours')
    expect(filteredInit).to.not.have.property('transpondeurs')

    await postJson(`${CLASSEMENTS_URL}/course/start`)
    await wsFiltered.waitForAllMessages([
      msg => msg.event === 'course' && msg.course?.status === 'COURSE',
      msg => msg.event === 'status' && msg.status?.status === 'start',
    ], {
      label: 'filtered course/status events',
      maxMessages: 30,
    })

    await Promise.all([
      addManualTour({ id: 4001, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: 1000 }),
      addManualTour({ id: 4002, transpondeur: fixture.team2.transpondeur, dossard: fixture.team2.dossard, timestamp: 1100 }),
    ])

    const { message: updateMessage } = await wsAll.waitForMessage(
      msg => msg.event === 'update' && Array.isArray(msg.events) && msg.events.length >= 2,
      { timeout: 12000, label: 'batched update event' },
    )

    const eventKinds = updateMessage.events.map(event => event.event)
    expect(eventKinds).to.include('tour')
    expect(eventKinds).to.include('equipe')

    await postJson(`${SIM_URL}/disconnect`)
    await wsFiltered.waitForMessage(
      msg => (
        (msg.event === 'connection' && msg.connection?.connected === false) ||
        (msg.event === 'status' && msg.status?.chrono_connected === false)
      ),
      { timeout: 12000, label: 'chrono_connected false status' },
    )

    await postJson(`${SIM_URL}/connect`)
    await wsFiltered.waitForMessage(
      msg => (
        (msg.event === 'connection' && msg.connection?.connected === true) ||
        (msg.event === 'status' && msg.status?.chrono_connected === true) ||
        (msg.event === 'status' && msg.status?.status === 'start')
      ),
      { timeout: 12000, label: 'chrono_connected true status' },
    )
  })
})
