'use strict'
require('dotenv/config')
const chrono = require('./chrono')
const model = require('./model')
const EventEmitter = require('node:events')

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

module.exports = async function(fastify, opts) {
  fastify.register(require('@fastify/websocket'))

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

  fastify.register(async function(_fastify) {
    _fastify.get('/tours', { websocket: true }, async (socket, req) => {
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
      chrono.on('connection', send)
      
      await send({ connected: chrono.getConnected() })
      
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

  await chrono.init()
  const opened = await model.isOpened()
  let first = true
  // setup status check interval
  setInterval(async () => {
    try {
      // FIXME
      const status = await chrono.check()
      if (status && first) {
        first = false
        if (status === 'stop' && opened) {
          console.log('found an open file but chrono is stoped, closing the file')
          await model.closeDb()
        }
      }
    } catch (err) {
      console.error(err)
    }
  }, 1000)
}
