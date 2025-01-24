'use strict'
import * as models from '../models.js'
import { parse } from 'csv-parse/sync'
import { start, stop } from '../tours.js'

export default async function route(fastify, opts) {
  fastify.post('/import', async function (request, reply) {
    const { name } = request.body
    await models.create(name)
    const knex = models.getKnex()
    await knex.transaction(async transaction => {
      for (const object of ['equipes', 'equipiers', 'transpondeurs']) {
        if (request.raw.files[object]) {
          const rows = parse(request.raw.files[object].data, {
            columns: true,
            skip_empty_lines: true
          })
          for (const row of rows) {
            await transaction.insert(row).into(object)
          }
        }
      }
    })
    await models.load()
    await models.startTest()

    reply.redirect(request.headers.referer)
  })

  fastify.post('/test/start', async function(request, reply) {
    await start()
    await models.startTest()
    return {}
  })

  fastify.post('/test/stop', async function(request, reply) {
    await stop()
    await models.stopTest()
    return {}
  })

  fastify.post('/course/start', async function(request, reply) {
    await start()
    await models.startCourse()
    return {}
  })

  fastify.post('/course/stop', async function(request, reply) {
    await stop()
    await models.stopCourse()
    return {}
  })

  fastify.post('/course/close', async function(request, reply) {
    await models.close()
  })

  fastify.post('/course/open', async function(request, reply) {
    await models.open(request.body.filename)
  })
}
