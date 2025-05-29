'use strict'
import * as sql from '../sql.js'
import * as models from '../models.js'
import { start, stop } from '../tours.js'

export default async function route(fastify, opts) {
  fastify.post('/test/start', async function(request, reply) {
    models.lockStatus()
    await start()
    await models.startTest()
    return {}
  })

  fastify.post('/test/stop', async function(request, reply) {
    models.lockStatus()
    await stop()
    await models.stopTest()
    return {}
  })

  fastify.post('/course/start', async function(request, reply) {
    models.lockStatus()
    await start()
    await models.startCourse()
    return {}
  })

  fastify.post('/course/stop', async function(request, reply) {
    models.lockStatus()
    await stop()
    await models.stopCourse()
    return {}
  })

  fastify.post('/course/close', async function(request, reply) {
    await sql.close()
  })

  fastify.post('/course/open', async function(request, reply) {
    await sql.open(request.body.filename)
    await models.initModel()
  })
}

