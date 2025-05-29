'use strict'
require('dotenv/config')
const chrono = require('./chrono')
const path = require('node:path')

module.exports = async function(fastify, opts) {
  fastify.register(require('@fastify/websocket'))
  fastify.register(require('@fastify/cors'), {
    origin: '*',
  })
  fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, 'ui'),
  })

  let send

  fastify.register(async function(_fastify) {
    _fastify.get('/ws', { websocket: true }, async (websocket, req) => {
      console.log('ws connected')
      const listen = (obj, event, cb) => {
        obj.on(event, cb)
        websocket.on('close', () => {
          try {
          obj.removeListener(event, cb)
          } catch(err) { console.error('websocket close', err) }
        })
      }
      send = async data => {
        try {
          // console.log('sending to websocket', JSON.stringify(data))

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
  })

  fastify.post('/tours/add', async (req, res) => {
    if (req.headers['content-type'] === 'text/plain') {
      for (const line of req.body.split(/[\n\r]+/g))
        chrono.addTour(line)
      send(chrono.getInfo())
      return
    }
    chrono.addTour(`<STA ${req.body.transpondeur} ${chrono.getTimeString(req.body.timestamp)} 99 01 3 1579>`, true)
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

  await chrono.init()
}
