'use strict'
import * as models from '../models.js'
import { parse } from 'csv-parse/sync'
import { start } from '../tours.js'
import * as sql from '../sql.js'

export default async function route(fastify, opts) {
  fastify.post('/import', async function (request, reply) {
    const { name } = request.body
    await sql.create(name)
    const knex = sql.getKnex()
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
    await sql.load()
    await start()
    await models.startTest()

    reply.redirect(request.headers.referer)
  })
}
