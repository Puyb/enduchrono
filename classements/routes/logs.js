'use strict'
import { listActionLogs } from '../actionLog.js'

export default async function route(fastify, opts) {
  fastify.get('/logs', async function (request, reply) {
    const { equipe } = request.query
    return { logs: await listActionLogs({ equipe: equipe != null ? Number(equipe) : null }) }
  })
}
