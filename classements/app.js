'use strict'

const path = require('path')
const AutoLoad = require('@fastify/autoload')
const Static = require('@fastify/static')
const { open, addTour, syncStatus } = require('./models')
const { connect, on } = require('./tours')

module.exports = async function (fastify, opts) {
  fastify.register(require('fastify-file-upload'))
  fastify.register(require('@fastify/websocket'))
  await fastify.register(require( '@fastify/cors'), {
    origin: '*',
  })

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: Object.assign({}, opts)
  })

  fastify.register(Static, {
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
