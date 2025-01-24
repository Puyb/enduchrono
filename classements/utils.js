import fs from 'node:fs/promises'

export async function exists(name) {
  try {
    await fs.access(name, fs.constants.F_OK)
    return true
  } catch (err) { // eslint-disable-line no-unused-vars
    return false
  }
}

