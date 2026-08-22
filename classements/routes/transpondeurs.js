'use strict'
const { addTranspondeur } = require('../models')
const { logAction } = require('../actionLog')
const { equipeIdFromDossard } = require('../classes')

module.exports = async function (fastify, opts) {
  fastify.post('/transpondeur', async function (request, reply) {
    console.log('body', request.body)
    const data = JSON.parse(request.body)
    await addTranspondeur(data)
    await logAction({
      action: "Ajout/modification d'un transpondeur",
      objectType: 'transpondeur',
      objectId: data.id,
      equipe: equipeIdFromDossard(data.dossard),
      data,
    })
    return {}
  })
}
