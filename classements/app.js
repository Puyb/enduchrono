'use strict'

const path = require('path')
const { open} = require('./sql')
const { initModel, addTour, syncStatus } = require('./models')
const { connect, events } = require('./tours')

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

  // open db
  if (await open()) await initModel()
  // connect to chrono
  await connect()
  console.log('connected')
  events.on('tour', data => console.log('tour', data))
  events.on('tour', data => addTour(data))
  events.on('status', ({ status }) => syncStatus(status)) 
}
