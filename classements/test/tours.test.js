/* global describe, it, afterEach */
import { expect } from 'chai'
import sinon from 'sinon'
import * as tours from '../tours.js'

describe('tours - getElapsed (horloge course utilisee par actionLog.js)', () => {
  afterEach(() => {
    sinon.restore()
  })

  it('is null before any start() has happened', () => {
    expect(tours.getElapsed()).to.equal(null)
  })

  it('starts counting from start() and stops counting after stop()', async () => {
    sinon.stub(global, 'fetch').resolves({ status: 200, json: async () => ({}) })

    const startPromise = tours.start()
    setTimeout(() => tours.events.emit('status', { status: 'start' }), 0)
    await startPromise

    expect(tours.getElapsed()).to.be.a('number')
    expect(tours.getElapsed()).to.be.at.least(0)

    const stopPromise = tours.stop()
    setTimeout(() => tours.events.emit('status', { status: 'stop' }), 0)
    await stopPromise

    expect(tours.getElapsed()).to.equal(null)
  })
})
