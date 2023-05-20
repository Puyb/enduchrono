'use strict'
const { addListener, removeListener, tours, equipes, equipiers } = require('../models')
const _ = require('lodash')

module.exports = async function (fastify, opts) {
  fastify.get('/websockets/control', { websocket: true }, async (connection, req) => {
    await connection.socket.send(JSON.stringify({
      event: 'init',
      tours,
      equipes: _.mapValues(equipes, equipe => ({ ...equipe, tours: equipe.tours.length })),
      equipiers
    }))
    const tourCallback = async (tour, equipe, equipier) => {
      await connection.socket.send(JSON.stringify({ event: 'tour', tour, equipier, equipe }))
    }
    addListener('tours', tourCallback)
    connection.socket.on('close', () => { removeListener('tours', tourCallback) })

    const equipeCallback = async (equipe) => {
      await connection.socket.send(JSON.stringify({ event: 'equipe', equipe: { ...equipe, tours: equipe.tours.length } }))
    }
    addListener('equipes', equipeCallback)
    connection.socket.on('close', () => { removeListener('equipes', equipeCallback) })
  })
}
