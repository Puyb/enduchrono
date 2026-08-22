'use strict'
import * as sql from '../sql.js'
import * as models from '../models.js'
import { start, stop } from '../tours.js'
import { logAction } from '../actionLog.js'

export default async function route(fastify, opts) {
  fastify.post('/test/start', async function(request, reply) {
    models.lockStatus()
    await start()
    await models.startTest()
    await logAction({ action: 'Démarrage du mode test', objectType: 'course' })
    return {}
  })

  fastify.post('/test/stop', async function(request, reply) {
    models.lockStatus()
    await stop()
    await models.stopTest()
    await logAction({ action: 'Arrêt du mode test', objectType: 'course' })
    return {}
  })

  fastify.post('/course/start', async function(request, reply) {
    models.lockStatus()
    await start()
    await models.startCourse()
    await logAction({ action: 'Départ de la course', objectType: 'course' })
    return {}
  })

  fastify.post('/course/stop', async function(request, reply) {
    models.lockStatus()
    await stop()
    await models.stopCourse()
    await logAction({ action: 'Arrêt de la course', objectType: 'course' })
    return {}
  })

  fastify.post('/course/close', async function(request, reply) {
    await logAction({ action: 'Fermeture de la course', objectType: 'course' })
    await sql.close()
  })

  fastify.post('/course/open', async function(request, reply) {
    await sql.open(request.body.filename)
    await models.initModel()
    await logAction({ action: 'Ouverture de la course', objectType: 'course', data: { filename: request.body.filename } })
  })
}

