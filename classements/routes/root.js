'use strict'
const { equipes, equipiers, transpondeurs, categories } = require('../models')

module.exports = async function (fastify, opts) {
  fastify.get('/', async function (request, reply) {
    return { root: true }
  })

  fastify.get('/equipes', async function (request, reply) {
    return { equipes }
  })
  fastify.get('/equipiers', async function (request, reply) {
    return { equipiers }
  })
  fastify.get('/transpondeurs', async function (request, reply) {
    return { transpondeurs }
  })
  fastify.get('/categories', async function (request, reply) {
    return { categories }
  })
}
