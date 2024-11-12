'use strict'

const path = require('path')
const AutoLoad = require('@fastify/autoload')
const { initDb, load } = require('./models')

// Pass --options via CLI arguments in command to enable these options.
module.exports.options = {}

module.exports = async function (fastify, opts) {
  // Place here your custom code!
  await initDb()
  await load().catch(console.error)
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
}
