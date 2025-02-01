'use strict'
import dgram from 'node:dgram'
import EventEmitter from 'node:events'

const {CHRONO_ADDRESS, SIMULATOR_ADDRESS } = process.env;
const PORT = 2008
const START = '1b07'
const STOP = '1b135c'
const STATUS = '1b05'
const ACK = '1b11'
const REPEAT = '1b12'

const TRANSPONDEUR_REGEXP = /^<STA (\d+) (\d+):(\d+)'(\d+)"(\d+) (\d+) (\d+) (\d+) (\d+)>/
// <STA 119371 00:00'11"648 99 01 3 1579>
let status = 'stop'
let timestamp = 0;
let timeMultiplier = 1
let toursSent = 0
const tours = [];
const toursToSend = []
let timestampTimer = null
const TIMESTAMP_INTERVAL = 100
let connected = true

const socket = dgram.createSocket('udp4')

const event = new EventEmitter()
export function on(name, cb) { event.on(name, cb) }
export function removeListener(name, cb) { event.removeListener(name, cb) }

const tourTimestamp = str => {
    const match = String(str).match(TRANSPONDEUR_REGEXP)
    if (!match) return
    const [, , hour, minute, second, milli] = match
    return ((parseInt(hour) * 60 + parseInt(minute)) * 60 + parseInt(second)) * 1000 + parseInt(milli)
}

socket.on('message', async (message, { address }) => {
  try {
    if (!connected) return
    const str = message.toString('hex')
    console.log(`received ${str} from ${address}`)
    event.emit('received', str)
    switch(str) {
      case START:
        status = 'start'
        event.emit('start')
        toursSent = 0
        if (!timestampTimer) {
          timestamp = 0
          timestampTimer = setInterval(() => {
            timestamp += TIMESTAMP_INTERVAL * timeMultiplier
            while(tourTimestamp(toursToSend[0]) <= timestamp) {
              if (tours.push(toursToSend[0]) === 1) {
                send(CHRONO_ADDRESS, tours[0])
                toursSent++
              }
              toursToSend.shift()
            }
            event.emit('timestamp', timestamp)
          }, TIMESTAMP_INTERVAL)
        }
        await send(CHRONO_ADDRESS, ACK)
        break;
      case STOP:
        status = 'stop'
        event.emit('stop')
        clearInterval(timestampTimer)
        timestampTimer = null
        await send(CHRONO_ADDRESS, ACK)
        break;
      case STATUS:
        await send(CHRONO_ADDRESS, JSON.stringify({
          status,
          timestamp,
          pending: tours.length,
        }))
        break;
      case REPEAT:
        if (tours.length) await send(CHRONO_ADDRESS, tours[0])
        break;
      case ACK:
        tours.shift()
        if (tours.length) {
          await send(CHRONO_ADDRESS, tours[0])
          toursSent++
        }
        break
    }
  } catch (err) {
    console.error(err)
  }
})

socket.on('listening', async () => {
  try {
    const address = socket.address()
    console.log(`server listening ${address.address}:${address.port}`)
    event.emit('ready')
  } catch (err) {
    console.error(err)
  }
})

const send = async (address, message) => {
  return new Promise((resolve, reject) => {
    console.log(`sending ${message.toString('hex')} to ${address}`)
    socket.send(message, 0, message.length, PORT, address, function (err, bytes) {
      if (err) return reject(err)
      resolve(bytes)
      event.emit('sent', message.toString('hex'))
    })
  })
}

export async function init() {
  return new Promise((resolve, reject) => {
    socket.once('error', reject)
    socket.once('listening', resolve)
    socket.bind(PORT, SIMULATOR_ADDRESS)
  })
}

export async function addTour(tour, now) {
  if (now) toursToSend.unshift(tour)
  else toursToSend.push(tour)
}

export function getTimestamp() { return timestamp }

export function getTimeString(t = timestamp) {
  let str = String(t).slice(-3)
  t = Math.floor(t / 1000)
  for (const sep of `"':`) {
    str = String(t % 60).padStart(2, '0') + sep + str
    t = Math.floor(t / 60)
  }
  return str
}

export function getTimeMultiplier(n) { return timeMultiplier }
export function setTimeMultiplier(n) { timeMultiplier = n }

export function getConnected() { return connected }
export function setConnected(c = true) { connected = c }

export function getStatus() { return status }
export function getInfo() { return { status, timeString: status === 'start' ? getTimeString() : 'stop', pending: tours.length, futur: toursToSend.length, sent: toursSent } }
