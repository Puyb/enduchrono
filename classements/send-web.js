'use strict';

import { equipes } from './classes.js'
import { events, getCourseInfo } from './models.js'
import WebSocket from 'ws'
import _ from 'lodash'

const BASE_URL = `${process.env.WEB_HOST || 'localhost'}:${process.env.WEB_PORT || 3001}`

let ws
export function webConnect() {
  const wsUrl = `ws://${BASE_URL}/input?token=${process.env.WEB_TOKEN}`
  ws = new WebSocket(wsUrl, {})

  const listen = (event, cb) => {
    events.on(event, cb)
    ws.on('close', () => {
      events.removeListener(event, cb)
    })
  }

  const send = async data => {
    try {
      console.log('sending to sendToWeb websocket', JSON.stringify(data))
      await ws.send(JSON.stringify(data))
    } catch (err) {
      console.error('error in send passage', err)
    }
  }

  ws.on('error', err => {
    console.error('sendToWeb websocket error', err)
    try {
      ws.close();
    } catch(err) { console.log('error closing websocket', err) }
  })
  ws.on('close', err => {
    console.error('sendToWeb websocket close')
    setTimeout(() => webConnect(), 1000)
  })

  const formatEquipe = equipe => ({
    equipe: equipe.equipe,
    nom: equipe.nom,
    categorie: equipe.categorie,
    penalite: equipe.penalite,
    position_general: equipe.position_general,
    position_categorie: equipe.position_categorie,
    temps: equipe.temps,
    tours: equipe.tours.length,
  })

  ws.on('open', async function open() {
    console.log('sendToWeb connected')

    const course = await getCourseInfo()
    await send({
      event: 'init',
      equipes: _.mapValues(equipes, equipe => formatEquipe(equipe)),
      course,
    });
    listen('equipes', async (equipe) => {
      await send({
        event: 'equipes',
        equipe: formatEquipe(equipe),
      });
    });
    listen('course', async (course) => {
      await send({
        event: 'course',
        course,
      });
    });
  }, 100);
}

export function webDisconnect() {
  ws.close()
}
