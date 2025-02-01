'use strict'

const path = require('path')
const { open, addTour, syncStatus } = require('./models')
const { connect, on } = require('./tours')

module.exports = async function (fastify, opts) {
  fastify.register(require('fastify-file-upload'))
  fastify.register(require('@fastify/multipart'))
  fastify.register(require('@fastify/websocket'))

  fastify.register(require( '@fastify/cors'), {
    origin: '*',
  })

  fastify.register(require('@fastify/autoload'), {
    dir: path.join(__dirname, 'routes'),
    options: Object.assign({}, opts)
  })

  fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, 'ui'),
  })

  // get status
  await open()
  // open db
  // connect to chrono
  await connect()
  on('tour', data => console.log('trou', data))
  on('tour', data => addTour(data.id, data.transpondeur, data.timestamp))
  on('status', ({ status }) => syncStatus(status)) 
}
