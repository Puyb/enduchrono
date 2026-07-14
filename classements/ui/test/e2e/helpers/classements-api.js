const { setTimeout: delay } = require('node:timers/promises')

const defaultApiBaseUrl = process.env.CLASSEMENTS_API_URL || 'http://localhost:3000'

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

function assertStatus(response, acceptedStatuses, label) {
  if (!acceptedStatuses.includes(response.status())) {
    throw new Error(`${label}: expected ${acceptedStatuses.join(', ')}, got ${response.status()}`)
  }
}

async function responseJson(response) {
  const text = await response.text()
  if (!text) return {}
  return JSON.parse(text)
}

function isTransientRequestError(error) {
  const message = String(error && error.message ? error.message : error)
  return [
    'socket hang up',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'fetch failed',
  ].some(token => message.includes(token))
}

async function withRetry(operation, options = {}) {
  const retries = options.retries === undefined ? 3 : options.retries
  const baseDelayMs = options.baseDelayMs || 250

  let lastError
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt >= retries || !isTransientRequestError(error)) throw error
      await delay(baseDelayMs * (attempt + 1))
    }
  }
  throw lastError
}

function createClassementsApi(request, options = {}) {
  const apiBaseUrl = options.apiBaseUrl || defaultApiBaseUrl

  async function waitForApiReady(options = {}) {
    const timeoutMs = options.timeoutMs || 30000
    const intervalMs = options.intervalMs || 300
    const deadline = Date.now() + timeoutMs
    let lastError = null

    while (Date.now() < deadline) {
      try {
        const response = await request.get(joinUrl(apiBaseUrl, '/'), {
          failOnStatusCode: false,
        })
        if (response.status() >= 200 && response.status() < 500) return
        lastError = new Error(`status ${response.status()}`)
      } catch (error) {
        lastError = error
      }
      await delay(intervalMs)
    }

    throw new Error(
      `API classements indisponible sur ${apiBaseUrl} apres ${timeoutMs}ms: ${
        lastError ? lastError.message : 'unknown error'
      }`,
    )
  }

  async function post(path, { data, multipart, headers, acceptedStatuses = [200], maxRedirects } = {}) {
    const response = await withRetry(() => request.post(joinUrl(apiBaseUrl, path), {
      data,
      multipart,
      headers,
      maxRedirects,
      failOnStatusCode: false,
    }), {
      retries: 2,
    })
    assertStatus(response, acceptedStatuses, `POST ${path}`)
    return response
  }

  async function del(path, { acceptedStatuses = [200] } = {}) {
    const response = await withRetry(() => request.delete(joinUrl(apiBaseUrl, path), {
      failOnStatusCode: false,
    }), {
      retries: 2,
    })
    assertStatus(response, acceptedStatuses, `DELETE ${path}`)
    return response
  }

  return {
    post,
    del,
    responseJson,
    waitForApiReady,
    closeCourse(options = {}) {
      return post('/course/close', {
        acceptedStatuses: options.acceptedStatuses || [200, 500],
      })
    },
    openCourse(filename) {
      return post('/course/open', {
        data: { filename },
      })
    },
    startCourse() {
      return post('/course/start')
    },
    stopCourse() {
      return post('/course/stop')
    },
    startTest() {
      return post('/test/start')
    },
    stopTest() {
      return post('/test/stop')
    },
    importCourseFromFixture(fixture) {
      return post('/import', {
        multipart: {
          name: fixture.courseName,
          equipes: {
            name: 'equipes.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(fixture.equipesCsv, 'utf8'),
          },
          equipiers: {
            name: 'equipiers.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(fixture.equipiersCsv, 'utf8'),
          },
          transpondeurs: {
            name: 'transpondeurs.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(fixture.transpondeursCsv, 'utf8'),
          },
        },
        headers: {
          referer: joinUrl(apiBaseUrl, '/'),
        },
        maxRedirects: 0,
        acceptedStatuses: [200, 302, 303],
      })
    },
    addTour(tour) {
      return post('/tour', { data: tour })
    },
    updateTourStatus(id, status) {
      return post(`/tour/${id}`, { data: { status } })
    },
    deleteTour(id) {
      return del(`/tour/${id}`)
    },
    updateEquipe(id, values) {
      return post(`/equipe/${id}`, { data: values })
    },
    upsertTranspondeur(transpondeur) {
      return post('/transpondeur', {
        data: JSON.stringify(transpondeur),
        headers: { 'content-type': 'text/plain' },
      })
    },
  }
}

module.exports = {
  createClassementsApi,
  defaultApiBaseUrl,
}
