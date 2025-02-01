'use strict'
import { getLastTourNumero } from './models.js'
import WebSocket from 'ws';
import Event from 'node:events'

const BASE_URL = `${process.env.CHRONO_HOST || 'localhost'}:${process.env.CHRONO_PORT || 3001}`

let ws
let connected = false
const event = new Event()
export function connect() {
  const wsUrl = `ws://${BASE_URL}/tours?from=${getLastTourNumero() || 0}`
  ws = new WebSocket(wsUrl, {})

  ws.on('error', err => {
    console.error('chrono websocket error', err)
    connected = false
    event.emit('connection', { connected, error: err.stack })
    try {
      ws.close();
    } catch(err) { console.log('error closing websocket', err) }
  })
  ws.on('close', err => {
    console.error('chrono websocket close')
    if (connected) {
      connected = false
      event.emit('connection', { connected, error: err.stack })
    }
    setTimeout(() => connect(), 1000)
  })

  ws.on('open', function open() {
    console.log('chrono connected')
    connected = true
    event.emit('connection', { connected })
  })

  ws.on('message', function message(str) {
    const data = JSON.parse(str)
    console.log('received: %s', data)
    if (data.passage) event.emit('tour', data.passage)
    if (data.status) {
      event.emit('status', data.status)
    }
    if ('connected' in data) {
      event.emit('status', { chrono_connected: data.connected })
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
  return response.json();
}

export async function start() { return command('start') }
export async function stop() { return command('stop') }

export function getConnected() { return connected }

export function on(name, cb) { return event.on(name, cb) }
export function removeListener(name, cb) { return event.removeListener(name, cb) }
