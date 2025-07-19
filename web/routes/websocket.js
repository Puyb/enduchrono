'use strict'
import { events, equipes, course } from '../fetch-websocket.js'

export default async function route(fastify, opts) {
  fastify.get('/input', { websocket: true }, async (websocket, req) => {
    websocket.on('message', message => {
      const data = JSON.parse(message)
      console.log('data', data)
      
      events.emit(data.event, data)
      if (data.event === 'init') {
        Object.assign(equipes, data.equipes)
        Object.assign(course, data.course)
      }
      if (data.event === 'equipes') {
        equipes[data.equipe.equipe] = data.equipe
      }
    })
    websocket.on('open', () => console.log('open'))
    websocket.on('error', console.error)
    websocket.on('close', () => console.log('close'))
  })
  fastify.get('/data', { websocket: true }, async (websocket, req) => {
    const send = async data => {
      try {
        await websocket.send(JSON.stringify(data))
      } catch (err) {
        console.error('errore send message', err)
      }
    }

    await send({
      event: 'init',
      equipes,
      course,
    })
    events.on('equipe', send)

    websocket.on('close', () => {
      events.removeListener('equipe', send);
    })
  })
}
