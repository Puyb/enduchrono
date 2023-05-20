'use strict'
const { knex, reset, load } = require('../models')
const { parse } = require('csv-parse/sync')

module.exports = async function (fastify, opts) {
  fastify.post('/import', async function (request, reply) {
    const response = {}
    await reset()
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
          response[object] = rows.length
        }
      }
    })
    await load()

    return response
  })
}
