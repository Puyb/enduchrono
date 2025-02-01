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

const TRANSPONDEUR_REGEXP = /^<STA (\d+) (\d+):(\d+)'(\d+)"(\d+) (\d+) (\d+) (\d+) (\d+)>/
// <STA 119371 00:00'11"648 99 01 3 1579>

const socket = dgram.createSocket('udp4')
let pendingCommand = null

const event = new EventEmitter()

socket.on('message', async (message, rinfo) => {
  try {
    console.log(`server got: ${message.toString()} from ${rinfo.address}:${rinfo.port}`)
    const match = message.toString().match(TRANSPONDEUR_REGEXP)
    if (match) {
      const [, transpondeur, hour, minute, second, milli] = match
      await send(ACK)
      const timestamp = ((parseInt(hour) * 60 + parseInt(minute)) * 60 + parseInt(second)) * 1000 + parseInt(milli)
      event.emit('passage', { transpondeur, timestamp })
    }
    if (pendingCommand) return pendingCommand(message)
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

const command = async (message) => {
  if (pendingCommand) throw new Error('pending command')
  return new Promise((resolve, reject) => {
    pendingCommand = resolve
    setTimeout(() => { reject(new TimeoutError()) }, 1000)
    send(message).catch(reject)
  }).finally(() => {
    pendingCommand = null
  })
}

const getStatus = async () => {
  try {
    const message = await command(STATUS)
    // decode status
    const { status, timestamp, pending } = JSON.parse(message.toString())
    return { connected: true, pending, timestamp, status }
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
  const { status, connected, pending, timestamp } = await getStatus()
  if (connected !== lastConnected) event.emit('connection', { connected })
  lastConnected = connected
  event.emit('status', { status: { timestamp, pending, status } })
  if (pending) await repeat()
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
  async start() { return command(START) },
  async stop() { return command(STOP) },
  getStatus,
  repeat,
  check,
  getConnected() { return lastConnected },
}
