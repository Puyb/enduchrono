'use strict'
const dgram = require('node:dgram')
const EventEmitter = require('node:events')

const {CHRONO_ADDRESS, CHRONELEC_ADDRESS } = process.env;
const PORT = 2008
const START = Buffer.from('1b07', 'hex')
const STOP = Buffer.from('1b135c', 'hex')
const STATUS = Buffer.from('1b05', 'hex')
const ACK = Buffer.from('1b11', 'hex')
const REPEAT = Buffer.from('1b12', 'hex')

// <STA 119371 00:00'11"648 99 01 3 1579>
const TRANSPONDEUR_REGEXP = /<STA (\d+) (\d+):(\d+)'(\d+)"(\d+) (\d+) (\d+) (\d+) (\d+)>/
// [00:00'12" 23 00 10 10]
const STATUS_REGEXP = /\[(\d+):(\d+)'(\d+)" (\d+) (\d+) (\d+) (\d+)\]/

const socket = dgram.createSocket('udp4')

// Le boitier chronelec peut regrouper plusieurs messages (un tour, une reponse
// de status, ...) dans un seul paquet UDP, separes par "\r\n". Chaque message
// doit etre traite independamment : les regex sont ancrees avec `^`, donc un
// message qui n'est pas au tout debut du buffer ne matcherait jamais si on
// testait le buffer entier tel quel (le tour ne serait alors ni detecte ni acke).
let lastSeenTranspondeur = null
let lastSeenTimestamp = null

const pendingCommands = {
  passage: {
    regex: TRANSPONDEUR_REGEXP,
    async resolve(match) {
      const [, transpondeur, hour, minute, second, milli, signal, detectionCount, battery, /* crc */] = match
      await send(ACK)
      const timestamp = ((parseInt(hour) * 60 + parseInt(minute)) * 60 + parseInt(second)) * 1000 + parseInt(milli)
      // Un tour renvoye par le boitier a l'identique (retransmission suite a un
      // ACK manque) ne doit pas etre traite deux fois : pas d'enregistrement en
      // base, pas de propagation vers classements.
      if (transpondeur === lastSeenTranspondeur && timestamp === lastSeenTimestamp) return
      lastSeenTranspondeur = transpondeur
      lastSeenTimestamp = timestamp
      event.emit('passage', { transpondeur, timestamp, signal: parseInt(signal), detectionCount: parseInt(detectionCount), battery: parseInt(battery) })
    }
  }
}

const event = new EventEmitter()

socket.on('message', async (message, rinfo) => {
  try {
    const raw = message.toString()
    console.log(`server got: ${raw} from ${rinfo.address}:${rinfo.port}`)
    for (const frame of raw.split('\r\n')) {
      if (!frame) continue
      for (const { regex, resolve } of Object.values(pendingCommands)) {
        const match = frame.match(regex)
        if (match) {
          await resolve(match)
        }
      }
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

const send = async message => {
  return new Promise((resolve, reject) => {
    console.log(`sending ${message.toString('hex')}`)
    socket.send(message, 0, message.length, PORT, CHRONELEC_ADDRESS, function (err, bytes) {
      if (err) return reject(err)
      resolve(bytes)
    })
  })
}

class TimeoutError extends Error {
  constructor(message = 'timeout on command') {
    super(message)
  }
}

const command = async (message, regex) => {
  return new Promise((resolve, reject) => {
    pendingCommands[message] = { regex, resolve }
    setTimeout(() => { reject(new TimeoutError()) }, 1000)
    send(message).catch(reject)
  })
}

let forceStatus = null // use to force the status when the chrono has just started
                       // as the chrono is still set to 0, we can't use it to determine the status
const getStatus = async () => {
  try {
    const match = await command(STATUS, STATUS_REGEXP)
    // decode status
    const [, hour, minute, second, noiseSta, noiseBox, minSta, minBox] = match
    const timestamp = ((parseInt(hour) * 60 + parseInt(minute)) * 60 + parseInt(second)) * 1000
    const status = forceStatus || (timestamp ? 'start' : 'stop')
    const noise = {
      Sta: noiseSta,
      Box: noiseBox,
      minSta,
      minBox,
    }
    return { connected: true, timestamp, status, noise }
  } catch (err) {
    if (!(err instanceof TimeoutError)) console.error('chronelec status error', err)
    return { connected: false }
  }
}

const repeat = async () => {
  await send(REPEAT)
}

let lastConnected = false
const check = async () => {
  const { status, connected, timestamp, noise } = await getStatus()
  if (connected !== lastConnected) event.emit('connection', { connected })
  lastConnected = connected
  event.emit('status', { status: { timestamp, status, noise, connected } })
  return status
}

module.exports = {
  on: event.on.bind(event),
  removeListener: event.removeListener.bind(event),
  async init() {
    return new Promise((resolve, reject) => {
      socket.once('error', reject)
      socket.once('listening', resolve)
      socket.bind(PORT, CHRONO_ADDRESS)
    })
  },
  async close() {
    return new Promise(resolve => socket.close(resolve))
  },
  send,
  command,
  async start() {
    await command(START, /^DEPART_/)
    forceStatus = 'start'
    setTimeout(() => forceStatus = null, 1100)
    await check()
  },
  async stop() {
    await command(STOP, /^STOP_/)
    await check()
  },
  getStatus,
  repeat,
  check,
  getConnected() { return lastConnected },
}
