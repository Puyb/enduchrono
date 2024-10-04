'use strict'
const { addTour } = require('../models')

module.exports = async function (fastify, opts) {
  fastify.post('/tour', async function (request, reply) {
    const equipes = await addTour(request.body.id, request.body.transpondeur, parseInt(request.body.timestamp))
    return { equipes }
  })
}
