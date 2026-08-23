'use strict'
import { getLastTourNumero } from './models.js'
import WebSocket from 'ws';
import Events from 'node:events'

const BASE_URL = `${process.env.CHRONO_HOST || 'localhost'}:${process.env.CHRONO_PORT || 3001}`

let ws
let connected = false
export const events = new Events()
export function connect() {
  const wsUrl = `ws://${BASE_URL}/tours?from=${getLastTourNumero() || 0}`
  ws = new WebSocket(wsUrl, {})

  ws.on('error', err => {
    console.error('chrono websocket error', err)
    connected = false
    events.emit('connection', { connected, error: err.stack })
    try {
      ws.close();
    } catch(err) { console.log('error closing websocket', err) }
  })
  ws.on('close', err => {
    console.error('chrono websocket close')
    if (connected) {
      connected = false
      events.emit('connection', { connected, error: err.stack })
    }
    setTimeout(() => connect(), 1000)
  })

  ws.on('open', function open() {
    console.log('chrono connected')
    connected = true
    events.emit('connection', { connected })
  })

  ws.on('message', function message(str) {
    const data = JSON.parse(str)
    console.log('received: %s', str)
    if (data.passage) events.emit('tour', data.passage)
    if (data.status) {
      events.emit('status', data.status)
      if ('connected' in data.status) {
        events.emit('status', { chrono_connected: data.status.connected })
      }
    }
    if ('connected' in data) {
      events.emit('status', { chrono_connected: data.connected })
    }
  })
}

export function disconnect() {
  ws.close()
}

export async function command(action) {
  const response = await fetch(`http://${BASE_URL}/${action}`, {
    method: "POST", // *GET, POST, PUT, DELETE, etc.
  });
  if (response.status >= 400) {
    throw new Error(`${response.status} - ${response.statusText} - ${await response.text()}`)
  }
  await waitForStatus(action)
  return response.json();
}

export async function waitForStatus(wanted) {
  return new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('timeout wait status')), 2100)
    const cb = ({ status }) => {
      console.log('wait status', status, wanted, status === wanted)
      if (status !== wanted) return
      resolve()
      events.removeListener('status', cb)
    }
    events.on('status', cb)
  })
}

// Top depart en horloge murale, utilise comme reference pour le temps ecoule
// des actions loguees (actionLog.js) : coherent avec le timestamp (elapsed)
// des tours, remis a zero a chaque (re)depart test/course.
let startedAt = null

export async function start() {
  const result = await command('start')
  startedAt = Date.now()
  return result
}
export async function stop() {
  const result = await command('stop')
  startedAt = null
  return result
}

export function getElapsed() {
  return startedAt == null ? null : Date.now() - startedAt
}

export function getConnected() { return connected }
