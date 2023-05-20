'use strict'
const dgram = require('node:dgram')

const ADDRESS = '192.168.45.101'
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

socket.on('error', (err) => {
  console.error(`server error:\n${err.stack}`)
  socket.close()
})

socket.on('message', async (message, rinfo) => {
  try {
    console.log(`server got: ${message.toString()} from ${rinfo.address}:${rinfo.port}`)
    if (pendingCommand) return pendingCommand(message)
    const match = message.toString().match(TRANSPONDEUR_REGEXP)
    if (!match) return
    const [, id, hour, minute, second, milli] = match
    await send(ACK)
    const timestamp = ((parseInt(hour) * 60 + parseInt(minute)) * 60 + parseInt(second)) * 1000 + parseInt(milli)
    console.log(id, timestamp)
  } catch (err) {
    console.error(err)
  }
})

socket.on('listening', async () => {
  try {
    const address = socket.address()
    console.log(`server listening ${address.address}:${address.port}`)
    await command(STOP)
    await command(START)
  } catch (err) {
    console.error(err)
  }
})

const send = async message => {
  return new Promise((resolve, reject) => {
    console.log(`sending ${message.toString('hex')}`)
    socket.send(message, 0, message.length, PORT, ADDRESS, function (err, bytes) {
      if (err) return reject(err)
      resolve(bytes)
    })
  })
}

const command = async (message) => {
  return new Promise((resolve, reject) => {
    pendingCommand = resolve
    setTimeout(() => { reject(new Error('timeout on command')) }, 1000)
    send(message).catch(reject)
  }).finally(() => {
    pendingCommand = null
  })
}

socket.bind(PORT)
