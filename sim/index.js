'use strict'
import Fastify from 'fastify'
import FastifyWebsocket from '@fastify/websocket'
import Static from '@fastify/static'
import path from 'path'
import * as chrono from './chrono.js'
import * as fastifyCors from '@fastify/cors'

const fastify = Fastify({
  logger: true
})
fastify.register(FastifyWebsocket)
fastify.register(fastifyCors, {
  origin: '*',
})
/*
fastify.register(Static, {
  root: path.join('ui/dist'),
})
*/

let send

fastify.register(async function(fastify) {
  fastify.get('/ws', { websocket: true }, async (websocket, req) => {
    console.log('ws connected')
    send = async data => {
      try {
        console.log('sending to websocket', JSON.stringify(data))
        await websocket.send(JSON.stringify(data))
      } catch (err) {
        console.error('error in send passage', err)
      }
    }

    websocket.on('message', message => {
    })
    chrono.on('timestamp', timestamp => send({ timestamp, timeString: chrono.getStatus() === 'start' ? chrono.getTimeString() : chrono.getStatus() }))

    const exit = async () => {
      console.log('exiting')
      await websocket.close()
      process.exit()
    }
    process.on('SIGINT', exit)
    process.on('SIGTERM', exit)

    websocket.on('close', () => {
      process.removeListener('SIGINT', exit)
      process.removeListener('SIGTERM', exit)
    })
    websocket.on('open', () => send(chrono.getInfo()))

    chrono.on('timestamp', timestamp => send(chrono.getInfo()))
    chrono.on('received', received => { send({ received }) })
    chrono.on('sent', sent => { send({ sent }) })
  })

  fastify.post('/tours/add', async (req, res) => {
    if (req.headers['content-type'] === 'text/plain') {
      for (const line of req.body.split(/[\n\r]+/g))
        chrono.addTour(line)
      send(chrono.getInfo())
      return
    }
    chrono.addTour(`<STA ${req.body.transpondeur} ${chrono.getTimeString(req.body.timestamp)} 99 01 3 1579>`)
  })
  fastify.post('/time/multiplier', async (req, res) => {
    chrono.setTimeMultiplier(parseInt(req.body.multiplier))
    return {}
  })
})

try {
  await Promise.all([
    chrono.init(),
    fastify.listen({ port: 3002 }),
  ])
} catch (err) {
  console.error(err)
  process.exit(1)
}
