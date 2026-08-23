'use strict'
const { addTour, modifTour } = require('../models')
const { logAction } = require('../actionLog')
const { equipeIdFromDossard } = require('../classes')

module.exports = async function (fastify, opts) {
  fastify.post('/tour', async function (request, reply) {
    const { tour, equipes } = await addTour(request.body)
    await logAction({
      action: "Ajout d'un tour",
      objectType: 'tour',
      objectId: tour.id,
      equipe: equipeIdFromDossard(tour.dossard),
      data: { transpondeur: tour.transpondeur, dossard: tour.dossard, timestamp: tour.timestamp, status: tour.status },
    })
    return { equipes }
  })
  fastify.post('/tour/:id', async function (request, reply) {
    const id = parseInt(request.params.id)
    const deleted = !!request.body.status
    const tour = await modifTour(id, deleted)
    if (tour) {
      await logAction({
        action: deleted ? "Suppression d'un tour" : "Restauration d'un tour",
        objectType: 'tour',
        objectId: tour.id,
        equipe: equipeIdFromDossard(tour.dossard),
        data: { status: tour.status },
      })
    }
    return {}
  })
  fastify.delete('/tour/:id', async function (request, reply) {
    const id = parseInt(request.params.id)
    const tour = await modifTour(id, true)
    if (tour) {
      await logAction({
        action: "Suppression d'un tour",
        objectType: 'tour',
        objectId: tour.id,
        equipe: equipeIdFromDossard(tour.dossard),
        data: { status: tour.status },
      })
    }
    return {}
  })
}
