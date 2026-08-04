'use strict'
import _ from 'lodash'
import { stringify } from 'csv-stringify/sync'
import { equipes, tours } from '../classes.js'
import { getCourseInfo } from '../models.js'

const CLASSEMENTS_COLUMNS = ['numero', 'temps', 'tours', 'position_generale', 'position_categorie', 'nom', 'categorie']
const TOURS_COLUMNS = ['id', 'dossard', 'numero', 'duree', 'timestamp']

const seconds = ms => Number.isFinite(ms) ? (ms / 1000).toFixed(3) : ''

const sendCsv = (reply, rows, columns, filename) => {
  const csv = stringify(rows, { header: true, columns })
  reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    .send(csv)
}

export default async function route(fastify, opts) {
  fastify.get('/export/classements.csv', async function (request, reply) {
    const course = await getCourseInfo()
    const nom = course?.name || 'course'

    const rows = _.sortBy(Object.values(equipes), 'position_general').map(equipe => ({
      numero: equipe.equipe,
      temps: seconds(equipe.temps),
      tours: equipe.tours.length + (equipe.penalite || 0),
      position_generale: equipe.position_general ?? '',
      position_categorie: equipe.position_categorie ?? '',
      nom: equipe.nom,
      categorie: equipe.categorie,
    }))

    sendCsv(reply, rows, CLASSEMENTS_COLUMNS, `${nom} - classements.csv`)
  })

  fastify.get('/export/tours.csv', async function (request, reply) {
    const course = await getCourseInfo()
    const nom = course?.name || 'course'

    const rows = _.sortBy(tours.filter(tour => !tour.status && tour.dossard), 'timestamp').map(tour => ({
      id: tour.id,
      dossard: tour.dossard,
      numero: tour.numeroEquipe ?? '',
      duree: seconds(tour.duree),
      timestamp: seconds(tour.timestamp),
    }))

    sendCsv(reply, rows, TOURS_COLUMNS, `${nom} - tours.csv`)
  })
}
