'use strict'
import { isConnected } from '../fetch-websocket.js'

export default async function route(fastify, opts) {
  fastify.get('/status', async (request, reply) => {
    return { websocket_connected: isConnected() }
  })
}
