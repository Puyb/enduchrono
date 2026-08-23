'use strict'
const { modifEquipe } = require('../models')
const { equipes, equipiers, transpondeurs, categories } = require('../classes')
const { logAction } = require('../actionLog')

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
    await logAction({
      action: "Modification d'une équipe",
      objectType: 'equipe',
      objectId: id,
      equipe: Number(id),
      data,
    })
    return {}
  })
}
