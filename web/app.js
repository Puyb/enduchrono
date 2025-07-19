'use strict'

const path = require('path')

const { fetchConnect } = require('./fetch-websocket')

module.exports = async function (fastify, opts) {
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

  fetchConnect()
}
