'use strict'
require('dotenv/config')
const chrono = require('./chrono')
const model = require('./model')
const EventEmitter = require('node:events')

const event = new EventEmitter()
chrono.on('passage', async ({ transpondeur, timestamp, signal, detectionCount, battery }) => {
  try {
    const id = await model.savePassage({ transpondeur, timestamp, signal, detectionCount, battery })
    event.emit('passage', {
      passage: { 
        id,
        transpondeur,
        timestamp,
        signal,
        detectionCount,
        battery,
      },
    })
  } catch (err) {
    console.error(err)
  }
})

chrono.on('connection', ({ connected }) => {
  if (!connected) return
  chrono.repeat().catch(err => {
    console.error('error requesting REPEAT after reconnect', err)
  })
})

module.exports = async function(fastify, opts) {
  // health endpoint (no side effects)
  fastify.get('/', async () => {
    return { status: 'ok' }
  })
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

  fastify.register(async function(_fastify) {
    _fastify.get('/tours', { websocket: true }, async (socket, req) => {
      const send = async data => {
        try {
          console.log('sending to websocket', JSON.stringify(data))
          await socket.send(JSON.stringify(data))
        } catch (err) {
          console.error('error in send passage', err)
        }
      }

      let lastSentId = 0
      // On bufferise les evenements live des la connexion (avant meme de savoir
      // si la session est demarree) : sinon un tour ajoute juste apres l'ouverture
      // du websocket peut arriver avant que sendPassages() n'ait fini son replay
      // sqlite et branche le listener live, et serait alors perdu.
      const buffer = []
      let passageListener = evt => buffer.push(evt)
      event.on('passage', passageListener)

      let sendPassages = async () => {
        const from = parseInt(req.query.from)
        const passages = await model.getPassages(from)
        for (const passage of passages) {
          console.log(passage)
          await send(passage)
          lastSentId = Math.max(lastSentId, passage.id)
        }

        event.removeListener('passage', passageListener)
        for (const evt of buffer) {
          if (evt.passage.id > lastSentId) {
            await send(evt)
            lastSentId = evt.passage.id
          }
        }
        passageListener = send
        event.on('passage', passageListener)
      }
      chrono.on('status', ({status}) => {
        if (status.status === 'start' && sendPassages) {
          sendPassages().catch(console.error);
          sendPassages = null;
        }
      });
      chrono.on('status', send)
      chrono.on('connection', send)

      await send({ connected: chrono.getConnected() })
      // Force un check immediat plutot que d'attendre le prochain tick du
      // setInterval (jusqu'a 1s) : sinon un client qui se connecte alors que
      // la session est deja demarree rate les passages emis pendant cette fenetre.
      await chrono.check().catch(console.error)

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
        event.removeListener('passage', passageListener)
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
