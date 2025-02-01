'use strict'
import { tours, equipes, equipiers, categories, transpondeurs, getCourseInfo } from '../models.js'
import * as models from '../models.js'
import * as chrono from '../tours.js'
import _ from 'lodash'

export default async function route(fastify, opts) {
  fastify.get('/websockets/control', { websocket: true }, async (websocket, req) => {
    const listen = (obj, event, cb) => {
      obj.on(event, cb)
      websocket.on('close', () => {
        obj.removeListener(event, cb)
      })
    }
    const send = async data => {
      try {
        console.log('sending to websocket', JSON.stringify(data))
        await websocket.send(JSON.stringify(data))
      } catch (err) {
        console.error('error in send passage', err)
      }
    }
    const sendInit = async () => {
      const course = await getCourseInfo()
      await send({
        event: 'init',
        course,
        categories: _.without(Object.keys(categories), 'general'),
        tours,
        equipes: _.mapValues(equipes, equipe => ({ ...equipe, tours: equipe.tours.length })),
        equipiers,
        transpondeurs: _.values(transpondeurs),
        filenames: await models.list(),
      })
    }
    sendInit()
    listen(models, 'close', sendInit)
    listen(models, 'open', sendInit)

    listen(models, 'course', async (course) => send({ event: 'course', course }))

    const toursQueue = []
    const equipesQueue = {}
    const transpondeursQueue = {}
    listen(models, 'tours', async (tour, equipe, equipier, update = false) => {
      toursQueue.push({ event: 'tour', tour, update })
      sendUpdates()
    })
    listen(models, 'equipes', async (equipe) => {
      equipesQueue[equipe.equipe] = { event: 'equipe', equipe: { ...equipe, tours: equipe.tours.length } }
      sendUpdates()
    })
    listen(models, 'transpondeur', async (transpondeur) => {
      transpondeursQueue[transpondeur.id] = { event: 'transpondeur', transpondeur }
      sendUpdates()
    })
    listen(chrono, 'status', status => send({ event: 'status', status }))
    listen(chrono, 'connection', connection => send({ event: 'connection', connection }))

    const sendUpdates = _.throttle(async () => {
      const events = [...toursQueue, ...Object.values(equipesQueue), ...Object.values(transpondeursQueue) ]
      emptyQueues()
      await send({ event: 'update', events })
    }, 200)

    const emptyQueues = () => {
      toursQueue.length = 0
      for (const key in equipesQueue) delete equipesQueue[key]
    }
    websocket.on('close', emptyQueues)
  })
}
