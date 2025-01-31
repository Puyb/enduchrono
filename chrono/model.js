'use strict'
const { exists } = require('./utils')
const fs = require('node:fs/promises')
const path = require('path')
const Knex = require('knex')

const DIR = './'
const CURRENT_FILENAME = path.join(DIR, 'current.db')

const openOrCreate = async () => {
  if (await exists(CURRENT_FILENAME)) return open(CURRENT_FILENAME)
  const filename = path.join(DIR, `${(new Date()).toISOString()}.db`)
  const knex = await open(filename)
  await fs.symlink(filename, CURRENT_FILENAME)
  await knex.schema.createTable('passages', (table) => {
    table.increments('id')
    table.string('transpondeur')
    table.integer('timestamp')
    table.primary(['id'])
  })
  return knex;
}

const open = async filename => {
  return Knex({
    client: 'sqlite3',
    connection: { filename }
  })
}

let currentKnexPromise
const getKnex = async () => {
  if (currentKnexPromise) return currentKnexPromise
  currentKnexPromise = openOrCreate()
  return currentKnexPromise
}

const savePassage = async ({ transpondeur, timestamp }) => {
  const knex = await getKnex()
  const [id] = await knex.insert({ transpondeur, timestamp }).into('passages')
  return id
}

const createDb = async () => {
  await getKnex()
}

const closeDb = async () => {
  currentKnexPromise = null
  await fs.rm(CURRENT_FILENAME)
}

const getPassages = async (from) => {
  const knex = await getKnex()
  return knex.select().table('passages').where('id', '>', from)
}

module.exports = {
  savePassage,
  getPassages,
  createDb,
  closeDb,
  async isOpened() { return exists(CURRENT_FILENAME) }
}

