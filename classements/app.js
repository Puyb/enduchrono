'use strict'

const path = require('path')
const AutoLoad = require('@fastify/autoload')
const Static = require('@fastify/static')
const { open, addTour } = require('./models')
const { connect, on } = require('./tours')

module.exports = async function (fastify, opts) {
  fastify.register(require('fastify-file-upload'))
  fastify.register(require('@fastify/websocket'))
  await fastify.register(require( '@fastify/cors'), {
    origin: '*',
  })

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: Object.assign({}, opts)
  })

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: Object.assign({}, opts)
  })

  fastify.register(Static, {
    root: path.join(__dirname, 'ui/dist'),
  })

  // get status
  await open()
  // open db
  // connect to chrono
  await connect()
  on('tour', data => console.log('trou', data))
  on('tour', data => addTour(data.id, data.transpondeur, data.timestamp))
}
