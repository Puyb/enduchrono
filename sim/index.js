'use strict'
import 'dotenv/config'
import Fastify from 'fastify'
import FastifyWebsocket from '@fastify/websocket'
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
    const listen = (obj, event, cb) => {
      obj.on(event, cb)
      websocket.on('close', () => {
        obj.removeListener(event, cb)
      })
    }
    send = async data => {
      try {
        console.log('sending to websocket', JSON.stringify(data))
        await websocket.send(JSON.stringify(data))
      } catch (err) {
        console.error('error in send passage', err)
      }
    }

    const exit = async () => {
      console.log('exiting')
      await websocket.close()
      process.exit()
    }
    listen(process, 'SIGINT', exit)
    listen(process, 'SIGTERM', exit)

    websocket.on('open', () => send(chrono.getInfo()))

    listen(chrono, 'timestamp', timestamp => send(chrono.getInfo()))
    listen(chrono, 'received', received => send({ received }))
    listen(chrono, 'sent', sent => send({ sent }))
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
  fastify.post('/connect', async (req, res) => {
    chrono.setConnected(true)
  })
  fastify.post('/disconnect', async (req, res) => {
    chrono.setConnected(false)
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
