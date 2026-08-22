'use strict'
const { expect } = require('chai')
const dgram = require('node:dgram')
const { setTimeout: delay } = require('node:timers/promises')

// Unit-level regression tests for the chronelec UDP framing, run fully
// in-process (no docker/sim needed): a fake "device" UDP socket plays the
// exact byte sequences captured by hand on real chronelec hardware, straight
// into `chrono/chrono.js`'s socket.
const CHRONO_ADDR = '127.0.0.11'
const DEVICE_ADDR = '127.0.0.12'
const PORT = 2008
const ACK_HEX = '1b11'

describe('chronelec UDP protocol - multi-message packets & duplicate laps', function () {
  this.timeout(5000)

  let chrono
  let device
  let received
  let passages

  beforeEach(async () => {
    process.env.CHRONO_ADDRESS = CHRONO_ADDR
    process.env.CHRONELEC_ADDRESS = DEVICE_ADDR
    delete require.cache[require.resolve('../chrono')]
    chrono = require('../chrono')

    received = []
    passages = []
    chrono.on('passage', p => passages.push(p))

    device = dgram.createSocket('udp4')
    device.on('message', msg => received.push(Buffer.from(msg)))
    await new Promise((resolve, reject) => {
      device.once('error', reject)
      device.once('listening', resolve)
      device.bind(PORT, DEVICE_ADDR)
    })

    await chrono.init()
  })

  afterEach(async () => {
    await chrono.close()
    await new Promise(resolve => device.close(resolve))
  })

  const send = frame => new Promise((resolve, reject) => {
    device.send(frame, 0, frame.length, PORT, CHRONO_ADDR, err => (err ? reject(err) : resolve()))
  })

  it('acks and records a lap even when it is not the first frame in the packet', async () => {
    // captured on real hardware: a status frame followed by a lap, in ONE datagram
    const packet = Buffer.from('[00:16\'13" 23 02 10 10]\r\n<STA 119370 00:16\'10"398 97 01 3 1584>\r\n')
    await send(packet)
    await delay(100)

    expect(passages.map(p => p.transpondeur)).to.include('119370')
    expect(received.some(b => b.toString('hex') === ACK_HEX)).to.equal(true)
  })

  it('replays the exact multi-message packets captured on prod hardware', async () => {
    await send(Buffer.from('<STA 119376 00:16\'10"371 99 01 3 1583>\r\n'))
    await delay(50)
    await send(Buffer.from('<STA 119370 00:16\'10"398 97 01 3 1584>\r\n[00:16\'13" 23 02 10 10]\r\n'))
    await delay(50)
    await send(Buffer.from('[00:16\'21" 24 02 10 10]\r\n[00:16\'21" 24 02 10 10]\r\n'))
    await delay(100)

    expect(passages.map(p => p.transpondeur)).to.deep.equal(['119376', '119370'])
  })

  it('does not double-count a lap retransmitted by the device after a missed ack', async () => {
    const frame = Buffer.from('<STA 42 00:00\'01"000 99 01 3 1>\r\n')
    await send(frame) // original
    await delay(50)
    await send(frame) // device retransmit, identical bytes
    await delay(100)

    expect(passages).to.have.lengthOf(1)
    expect(passages[0]).to.include({ transpondeur: '42', timestamp: 1000 })
    // both the original and the retransmit must still be acked, or the device
    // would keep retrying forever
    expect(received.filter(b => b.toString('hex') === ACK_HEX)).to.have.lengthOf(2)
  })
})
