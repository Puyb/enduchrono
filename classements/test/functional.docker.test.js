/* global describe, it, before, beforeEach, afterEach */
import { expect } from 'chai'
import WebSocket from 'ws'
import { setTimeout as delay } from 'node:timers/promises'

const CLASSEMENTS_URL = process.env.CLASSEMENTS_URL || 'http://classements-dev:3000'
const CHRONO_URL = process.env.CHRONO_URL || 'http://chrono-dev:3000'
const SIM_URL = process.env.SIM_URL || 'http://sim-dev:3000'
const CONTROL_WS_URL = CLASSEMENTS_URL.replace(/^http/, 'ws') + '/websockets/control'

const DUPLICATE_WINDOW_PERIOD = 2 * 60 * 1000
const COURSE_DUREE = 6 * 3600 * 1000

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

function createControlWsClient({ topics } = {}) {
  const query = topics?.length ? `?topics=${topics.join(',')}` : ''
  const ws = new WebSocket(`${CONTROL_WS_URL}${query}`)
  const messages = []
  let fatalError = null

  const ensureNoFatalError = () => {
    if (fatalError) throw fatalError
  }

  const waitForMessage = async (predicate, options = {}) => {
    const {
      timeout = 10000,
      from = 0,
      label = 'websocket message',
    } = options

    return waitFor(() => {
      ensureNoFatalError()
      for (let index = from; index < messages.length; index++) {
        const message = messages[index]
        if (predicate(message, index)) {
          return { message, index }
        }
      }
      return null
    }, { timeout, interval: 50, label })
  }

  const waitForTour = async (matcher, options = {}) => {
    const {
      timeout = 10000,
      from = 0,
      label = 'tour update',
    } = options

    return waitFor(() => {
      ensureNoFatalError()
      for (let index = from; index < messages.length; index++) {
        for (const event of extractUpdateEvents(messages[index])) {
          if (event.event !== 'tour') continue
          if (matcher(event.tour, event, index, messages[index])) {
            return { tour: event.tour, event, index, message: messages[index] }
          }
        }
      }
      return null
    }, { timeout, interval: 50, label })
  }

  const waitUntilOpen = new Promise((resolve, reject) => {
    let opened = false
    ws.on('open', () => {
      opened = true
      resolve()
    })
    ws.on('error', err => {
      if (!opened) reject(err)
    })
  })

  ws.on('message', data => {
    try {
      const parsed = JSON.parse(String(data))
      messages.push(parsed)
    } catch (err) {
      fatalError = new Error(`invalid websocket JSON message: ${String(data)} (${err.message})`)
    }
  })
  ws.on('error', err => {
    fatalError = err
  })

  return {
    ws,
    messages,
    waitUntilOpen,
    waitForMessage,
    waitForTour,
    async close() {
      if (ws.readyState !== WebSocket.CLOSED) {
        await new Promise(resolve => {
          const timeout = setTimeout(resolve, 500)
          ws.once('close', () => {
            clearTimeout(timeout)
            resolve()
          })
          ws.close()
        })
      }
      ensureNoFatalError()
    },
  }
}

async function waitForCourseSnapshot(wsClient, courseName, from = 0) {
  return wsClient.waitForMessage(
    msg => msg.event === 'init' && msg.course?.name === courseName,
    {
      from,
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
    timeout: 10000,
    interval: 100,
    label: `team ${teamId} tours >= ${expectedLength}`,
  })
}

describe('classements functional (docker stack)', function () {
  this.timeout(90000)

  const wsClients = []

  async function openWs(options = {}) {
    const client = createControlWsClient(options)
    wsClients.push(client)
    await client.waitUntilOpen
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
    const { index: initIndex } = await waitForCourseSnapshot(ws, fixture.courseName)
    let cursor = initIndex + 1

    const expectTransition = async ({ endpoint, courseStatus, chronoStatus, simStatus }) => {
      await postJson(`${CLASSEMENTS_URL}${endpoint}`)

      const [{ index: courseIndex }, { index: statusIndex }] = await Promise.all([
        ws.waitForMessage(
          msg => msg.event === 'course' && msg.course?.status === courseStatus,
          { from: cursor, label: `course status ${courseStatus}` },
        ),
        ws.waitForMessage(
          msg => msg.event === 'status' && msg.status?.status === chronoStatus,
          { from: cursor, label: `chrono status ${chronoStatus}` },
        ),
      ])

      cursor = Math.max(courseIndex, statusIndex) + 1

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
    const { index: initIndex } = await waitForCourseSnapshot(ws, fixture.courseName)
    let cursor = initIndex + 1

    await addManualTour({ id: 1001, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: 1000 })
    const ignoreInTest = await ws.waitForTour(
      tour => tour.timestamp === 1000 && tour.status === 'ignore',
      { from: cursor, label: 'ignore in TEST' },
    )
    cursor = ignoreInTest.index + 1

    await postJson(`${CLASSEMENTS_URL}/test/stop`)
    const depart = await ws.waitForMessage(
      msg => msg.event === 'course' && msg.course?.status === 'DEPART',
      { from: cursor, label: 'status DEPART' },
    )
    cursor = depart.index + 1

    await addManualTour({ id: 1002, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: 2000 })
    const ignoreInDepart = await ws.waitForTour(
      tour => tour.timestamp === 2000 && tour.status === 'ignore',
      { from: cursor, label: 'ignore in DEPART' },
    )
    cursor = ignoreInDepart.index + 1

    await postJson(`${CLASSEMENTS_URL}/course/start`)
    const course = await ws.waitForMessage(
      msg => msg.event === 'course' && msg.course?.status === 'COURSE',
      { from: cursor, label: 'status COURSE' },
    )
    cursor = course.index + 1

    await addManualTour({ id: 1003, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: 130000 })
    const validInCourse = await ws.waitForTour(
      tour => tour.timestamp === 130000 && tour.status === null,
      { from: cursor, label: 'valid in COURSE' },
    )
    cursor = validInCourse.index + 1

    await postJson(`${CLASSEMENTS_URL}/course/stop`)
    const fin = await ws.waitForMessage(
      msg => msg.event === 'course' && msg.course?.status === 'FIN',
      { from: cursor, label: 'status FIN' },
    )
    cursor = fin.index + 1

    await addManualTour({ id: 1004, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: 260000 })
    await ws.waitForTour(
      tour => tour.timestamp === 260000 && tour.status === null,
      { from: cursor, label: 'valid in FIN' },
    )

    const team1 = await waitForTeamTours(1, 2)
    expect(team1.tours.map(tour => tour.timestamp)).to.deep.equal([130000, 260000])
  })

  it('covers duplicate detection (2 min window + 6h rule)', async () => {
    const ws = await openWs()
    const fixture = makeImportFixture('duplicates')

    await importCourse(fixture)
    const { index: initIndex } = await waitForCourseSnapshot(ws, fixture.courseName)
    let cursor = initIndex + 1

    await postJson(`${CLASSEMENTS_URL}/course/start`)
    const course = await ws.waitForMessage(
      msg => msg.event === 'course' && msg.course?.status === 'COURSE',
      { from: cursor, label: 'status COURSE before duplicates' },
    )
    cursor = course.index + 1

    const t1 = 1000
    const t2 = t1 + DUPLICATE_WINDOW_PERIOD - 1
    const t3 = COURSE_DUREE + 10
    const t4 = COURSE_DUREE + 11

    await addManualTour({ id: 2001, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: t1 })
    const lap1 = await ws.waitForTour(
      tour => tour.timestamp === t1 && tour.status === null,
      { from: cursor, label: 'first valid lap' },
    )
    cursor = lap1.index + 1

    await addManualTour({ id: 2002, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: t2 })
    const lap2 = await ws.waitForTour(
      tour => tour.timestamp === t2 && tour.status === 'duplicate',
      { from: cursor, label: '2 minute duplicate' },
    )
    cursor = lap2.index + 1

    await addManualTour({ id: 2003, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: t3 })
    const lap3 = await ws.waitForTour(
      tour => tour.timestamp === t3 && tour.status === null,
      { from: cursor, label: 'first lap over 6h' },
    )
    cursor = lap3.index + 1

    await addManualTour({ id: 2004, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: t4 })
    await ws.waitForTour(
      tour => tour.timestamp === t4 && tour.status === 'duplicate',
      { from: cursor, label: '6h guard duplicate' },
    )

    const team1 = await waitForTeamTours(1, 2)
    expect(team1.tours.map(tour => tour.timestamp)).to.deep.equal([t1, t3])
  })

  it('covers manual corrections (/tour, /tour/:id, /equipe/:id) and ranking impact', async () => {
    const ws = await openWs()
    const fixture = makeImportFixture('manual_corrections')

    await importCourse(fixture)
    const { index: initIndex } = await waitForCourseSnapshot(ws, fixture.courseName)
    let cursor = initIndex + 1

    await postJson(`${CLASSEMENTS_URL}/course/start`)
    const course = await ws.waitForMessage(
      msg => msg.event === 'course' && msg.course?.status === 'COURSE',
      { from: cursor, label: 'status COURSE before corrections' },
    )
    cursor = course.index + 1

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

    const { message: fullInit, index: fullInitIndex } = await waitForCourseSnapshot(wsAll, fixture.courseName)
    const { message: filteredInit, index: filteredInitIndex } = await waitForCourseSnapshot(wsFiltered, fixture.courseName)

    expect(fullInit).to.have.property('equipes')
    expect(fullInit).to.have.property('tours')
    expect(filteredInit).to.have.property('course')
    expect(filteredInit).to.not.have.property('equipes')
    expect(filteredInit).to.not.have.property('tours')
    expect(filteredInit).to.not.have.property('transpondeurs')

    let allCursor = fullInitIndex + 1
    let filteredCursor = filteredInitIndex + 1

    await postJson(`${CLASSEMENTS_URL}/course/start`)
    const courseOnFiltered = await wsFiltered.waitForMessage(
      msg => msg.event === 'course' && msg.course?.status === 'COURSE',
      { from: filteredCursor, label: 'filtered course event' },
    )
    filteredCursor = courseOnFiltered.index + 1

    const statusOnFiltered = await wsFiltered.waitForMessage(
      msg => msg.event === 'status' && msg.status?.status === 'start',
      { from: filteredCursor, label: 'filtered status event start' },
    )
    filteredCursor = statusOnFiltered.index + 1

    await Promise.all([
      addManualTour({ id: 4001, transpondeur: fixture.team1.transpondeur, dossard: fixture.team1.dossard, timestamp: 1000 }),
      addManualTour({ id: 4002, transpondeur: fixture.team2.transpondeur, dossard: fixture.team2.dossard, timestamp: 1100 }),
    ])

    const { message: updateMessage, index: updateIndex } = await wsAll.waitForMessage(
      msg => msg.event === 'update' && Array.isArray(msg.events) && msg.events.length >= 2,
      { from: allCursor, timeout: 12000, label: 'batched update event' },
    )
    allCursor = updateIndex + 1

    const eventKinds = updateMessage.events.map(event => event.event)
    expect(eventKinds).to.include('tour')
    expect(eventKinds).to.include('equipe')

    expect(
      wsFiltered.messages.slice(filteredCursor).some(msg => msg.event === 'update'),
      'filtered websocket should not receive update when topics exclude tours/equipes',
    ).to.equal(false)

    await postJson(`${SIM_URL}/disconnect`)
    const disconnectedStatus = await wsFiltered.waitForMessage(
      msg => msg.event === 'status' && msg.status?.chrono_connected === false,
      { from: filteredCursor, timeout: 12000, label: 'chrono_connected false status' },
    )
    filteredCursor = disconnectedStatus.index + 1

    await postJson(`${SIM_URL}/connect`)
    await wsFiltered.waitForMessage(
      msg => msg.event === 'status' && msg.status?.chrono_connected === true,
      { from: filteredCursor, timeout: 12000, label: 'chrono_connected true status' },
    )
  })
})
