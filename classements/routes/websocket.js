'use strict'
const { addListener, removeListener, tours, equipes, equipiers, categories, transpondeurs } = require('../models')
const _ = require('lodash')

module.exports = async function (fastify, opts) {
  fastify.get('/websockets/control', { websocket: true }, async (connection, req) => {
    await connection.socket.send(JSON.stringify({
      event: 'init',
      categories: _.without(Object.keys(categories), 'general'),
      tours,
      equipes: _.mapValues(equipes, equipe => ({ ...equipe, tours: equipe.tours.length })),
      equipiers,
      transpondeurs: _.values(transpondeurs),
    }))
    const toursQueue = []
    const equipesQueue = {}
    const transpondeursQueue = {}
    const tourCallback = async (tour, equipe, equipier, update = false) => {
      toursQueue.push({ event: 'tour', tour, update })
      sendUpdates()
    }
    addListener('tours', tourCallback)
    connection.socket.on('close', () => {
      removeListener('tours', tourCallback)
      emptyQueues()
    })

    const equipeCallback = async (equipe) => {
      equipesQueue[equipe.equipe] = { event: 'equipe', equipe: { ...equipe, tours: equipe.tours.length } }
      sendUpdates()
    }
    addListener('equipes', equipeCallback)
    connection.socket.on('close', () => {
      removeListener('equipes', equipeCallback)
      emptyQueues()
    })

    const transpondeurCallback = async (transpondeur) => {
      transpondeursQueue[transpondeur.id] = { event: 'transpondeur', transpondeur }
      sendUpdates()
    }
    addListener('transpondeur', transpondeurCallback)
    connection.socket.on('close', () => {
      removeListener('transpondeur', transpondeurCallback)
      emptyQueues()
    })

    const sendUpdates = _.throttle(async () => {
      const events = [...toursQueue, ...Object.values(equipesQueue), ...Object.values(transpondeursQueue) ]
      emptyQueues()
      await connection.socket.send(JSON.stringify({ event: 'update', events }))
    }, 200)

    const emptyQueues = () => {
      toursQueue.length = 0
      for (const key in equipesQueue) delete equipesQueue[key]
    }

  })
}
