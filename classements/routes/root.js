'use strict'
const { equipes, equipiers, transpondeurs, categories, modifEquipe } = require('../models')

module.exports = async function (fastify, opts) {
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
  fastify.post('/equipe/:id', async function (request, reply) {
    const id = request.params.id
    const data = request.body
    await modifEquipe(id, data)
    return {}
  })
}
