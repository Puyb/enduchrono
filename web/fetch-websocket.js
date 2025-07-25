'use strict';
import Events from 'node:events'
import WebSocket from 'ws'
import _ from 'lodash'

export const events = new Events()

export const equipes = {}
export const course = {}

const BASE_URL = `${process.env.CLASSEMENTS_HOST || 'localhost'}:${process.env.CLASSEMENTS_PORT || 3000}`

let ws
export function fetchConnect() {
  const wsUrl = `ws://${BASE_URL}/websockets/control?topics=equipes,course,open,close`
  ws = new WebSocket(wsUrl, {})

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString())
    console.log('message', message.toString())
    if (data.event === 'init') {
      events.emit(data.event, data)
      Object.assign(equipes, _.mapValues(data.equipes, formatEquipe))
      Object.assign(course, data.course)
    }
    if (data.event === 'update') {
      for (const event of data.events) {
        if (event.event === 'equipe') {
          events.emit(event.event, event)
          equipes[event.equipe.equipe] = formatEquipe(event.equipe)
        }
      }
    }
    if (data.event === 'course') {
    }
  })
  ws.on('close', (e) => {
    console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason)
    setTimeout(function() {
      fetchConnect();
    }, 1000)
  })
  ws.on('error', (err) => {
    console.error('Socket encountered error: ', err.message, 'Closing socket')
    ws.close();
  })
  ws.on('open', () => {
    console.log('connected', new Date())
  })

  const formatEquipe = equipe => _.pick(equipe, ['equipe', 'nom', 'categorie', 'penalite', 'position_general', 'position_categorie', 'temps', 'tours'])
}

export function fetchDisconnect() {
  ws.close()
}
