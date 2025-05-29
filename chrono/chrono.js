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
const TRANSPONDEUR_REGEXP = /^<STA (\d+) (\d+):(\d+)'(\d+)"(\d+) (\d+) (\d+) (\d+) (\d+)>/
// [00:00'12" 23 00 10 10]
const STATUS_REGEXP = /^\[(\d+):(\d+)'(\d+)" (\d+) (\d+) (\d+) (\d+)\]/

const socket = dgram.createSocket('udp4')
const pendingCommands = {
  passage: {
    regex: TRANSPONDEUR_REGEXP,
    async resolve(match) {
      const [, transpondeur, hour, minute, second, milli] = match
      await send(ACK)
      const timestamp = ((parseInt(hour) * 60 + parseInt(minute)) * 60 + parseInt(second)) * 1000 + parseInt(milli)
      event.emit('passage', { transpondeur, timestamp })
    }
  }
}

const event = new EventEmitter()

socket.on('message', async (message, rinfo) => {
  try {
    console.log(`server got: ${message.toString()} from ${rinfo.address}:${rinfo.port}`)
    for (const { regex, resolve } of Object.values(pendingCommands)) {
      const match = message.toString().match(regex)
      if (match) {
        resolve(match)
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
    if (err instanceof TimeoutError) return { connected: false }
    throw err
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
  event.emit('status', { status: { timestamp, status, noise } })
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
