'use strict'
import { getKnex } from '../sql.js'
import { getStatus, getToursCounts } from '../models.js'
import { Tour } from '../classes.js'

const MAX_LIMIT = 500
const DEFAULT_LIMIT = 100

// Reproduit exactement les buckets de statut de Tours.vue (classements/ui) :
// toursAll depend du statut de course (TEST -> tours ignores, sinon tous les
// tours non-ignores), les autres buckets filtrent ensuite ce sous-ensemble.
const applyStatusFilter = (query, statusBucket, isTest) => {
  if (isTest) {
    query.where('status', 'ignore')
  } else {
    query.where(b => b.whereNull('status').orWhereNot('status', 'ignore'))
  }
  switch (statusBucket) {
    case 'normaux':
      return query.whereNull('status').whereNotNull('dossard')
    case 'duplicate':
      return query.where('status', 'duplicate')
    case 'deleted':
      return query.where('status', 'deleted')
    case 'unknown':
      return query.whereNull('dossard')
    case 'all':
    default:
      return query
  }
}

const applySearchFilter = (query, search) => {
  const words = (search || '').toLowerCase().split(' ').filter(Boolean)
  for (const word of words) {
    query.where(b => b
      .whereRaw('LOWER(transpondeur) LIKE ?', [`%${word}%`])
      .orWhereRaw('LOWER(CAST(dossard AS TEXT)) LIKE ?', [`%${word}%`]))
  }
  return query
}

const applyCursor = (query, before) => {
  if (!before) return query
  const [timestamp, id] = before.split(':').map(Number)
  if (!Number.isFinite(timestamp) || !Number.isFinite(id)) return query
  return query.where(b => b
    .where('timestamp', '<', timestamp)
    .orWhere(b2 => b2.where('timestamp', timestamp).where('id', '<', id)))
}

export default async function route(fastify, opts) {
  fastify.get('/tours', async function (request, reply) {
    const knex = getKnex()
    const { before, status = 'all', dossard, equipe, search } = request.query
    const limit = Math.min(Math.max(parseInt(request.query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT)

    let query = knex('tours').select('*').orderBy('timestamp', 'desc').orderBy('id', 'desc')
    query = applyStatusFilter(query, status, getStatus() === 'TEST')
    if (dossard) query = query.where('dossard', Number(dossard))
    if (equipe) query = query.whereRaw('CAST(dossard / 10 AS INTEGER) = ?', [Number(equipe)])
    query = applySearchFilter(query, search)
    query = applyCursor(query, before)

    const rows = await query.limit(limit + 1)
    const hasMore = rows.length > limit
    // duree/numeroEquipe sont des getters calcules a partir de equipe.tours (cf. classes.js) :
    // on reconstruit des instances Tour pour que la reponse REST les expose, comme le fait deja le WebSocket.
    return { tours: rows.slice(0, limit).map(row => new Tour(row)), hasMore }
  })

  fastify.get('/tours/count', async function (request, reply) {
    return getToursCounts()
  })
}
