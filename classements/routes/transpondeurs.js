'use strict'
const { addTranspondeur } = require('../models')

module.exports = async function (fastify, opts) {
  fastify.post('/transpondeur', async function (request, reply) {
    console.log('body', request.body)
    await addTranspondeur(JSON.parse(request.body))
    return {}
  })
}
