'use strict'
const { addTour, modifTour } = require('../models')

module.exports = async function (fastify, opts) {
  fastify.post('/tour', async function (request, reply) {
    const equipes = await addTour(request.body.id, request.body.transpondeur, parseInt(request.body.timestamp))
    return { equipes }
  })
  fastify.delete('/tour/:id', async function (request, reply) {
    const id = parseInt(request.params.id)
    await modifTour(id, true)
    return {}
  })
}
