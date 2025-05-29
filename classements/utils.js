import fs from 'node:fs/promises'
import _ from 'lodash'

export async function exists(name) {
  try {
    await fs.access(name, fs.constants.F_OK)
    return true
  } catch (err) { // eslint-disable-line no-unused-vars
    return false
  }
}

// Async events
export class AsyncEventEmitter {
  constructor() {
    this.listeners = {}
  }
  on(type, callback) {
    if (!this.listeners[type]) this.listeners[type] = []
    this.listeners[type].push(callback)
  }
  removeListener(type, callback) { _.pull(this.listeners[type], callback) }
  async emit(type, ...args) {
    if (this.listeners[type]) {
      return Promise.all(this.listeners[type].map(callback => callback(...args)))
    }
  }
}
