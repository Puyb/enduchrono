'use strict'
import { getKnex } from './sql.js'
import { getElapsed } from './tours.js'

export async function logAction({ action, objectType, objectId = null, equipe = null, data = null }) {
  const knex = getKnex()
  if (!knex) return
  await knex.insert({
    timestamp: Date.now(),
    elapsed: getElapsed(),
    action,
    object_type: objectType,
    object_id: objectId == null ? null : String(objectId),
    equipe: equipe == null ? null : Number(equipe),
    data: data == null ? null : JSON.stringify(data),
  }).into('log')
}

export async function listActionLogs({ equipe } = {}) {
  const knex = getKnex()
  let query = knex('log').select('*').orderBy('id', 'desc')
  if (equipe != null) query = query.where('equipe', Number(equipe))
  const rows = await query
  return rows.map(row => ({ ...row, data: row.data ? JSON.parse(row.data) : null }))
}
