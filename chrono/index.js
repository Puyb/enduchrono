'use strict'
import 'dotenv/config'
import Fastify from 'fastify'
import chrono from './chrono.js'
import model from './model.js'
import EventEmitter from 'node:events'
import FastifyWebsocket from '@fastify/websocket'

const event = new EventEmitter()
chrono.on('passage', async ({ transpondeur, timestamp }) => {
  try {
    const id = await model.savePassage({ transpondeur, timestamp })
    event.emit('passage', {
      passage: { 
        id,
        transpondeur,
        timestamp,
      },
    })
  } catch (err) {
    console.error(err)
  }
})

const fastify = Fastify({
  logger: true
})
fastify.register(FastifyWebsocket)

fastify.register(async function(fastify) {
  fastify.post('/start', async function (request, reply) {
    await model.createDb()
    await chrono.start()
    reply.send({})
  })

  fastify.post('/stop', async function (request, reply) {
    await chrono.stop()
    await model.closeDb()
    reply.send({})
  })

  fastify.get('/status', async function (request, reply) {
    reply.send({})
  })

  fastify.get('/tours', { websocket: true }, async (socket, req) => {
    const from = parseInt(req.query.from)
    const send = async data => {
      try {
        console.log('sending to websocket', JSON.stringify(data))
        await socket.send(JSON.stringify(data))
      } catch (err) {
        console.error('error in send passage', err)
      }
    }

    const passages = await model.getPassages(from)
    for (const passage of passages) {
      console.log(passage)
      await send(passage)
    }

    event.on('passage', send)
    chrono.on('status', send)
    
    socket.on('message', message => {
    })
    const exit = async () => {
      console.log('exiting')
      await socket.close()
      process.exit()
    }
    process.on('SIGINT', exit)
    process.on('SIGTERM', exit)

    socket.on('close', () => {
      event.removeListener('passage', send)
      chrono.removeListener('status', send)
      process.removeListener('SIGINT', exit)
      process.removeListener('SIGTERM', exit)
    })
  })
})

try {
  await chrono.init()
  // setup status check interval
  setInterval(async () => {
    try {
      // FIXME
      await chrono.check()
    } catch (err) {
      console.error(err)
    }
  }, 1000)
  await fastify.listen({ port: 3001 })
} catch (err) {
  console.error(err)
  process.exit(1)
}
