'use strict';

export const tours = []
export const transpondeurs = {}
export const equipes = {}
export const equipiers = {}
export const categories = { general: [] }
export const STATUS = ['TEST', 'DEPART', 'COURSE', 'FIN']

export const reset = () => {
  tours.length = 0
  for (const obj of [ transpondeurs, equipes, equipiers, categories ]) {
    for (const k in obj) delete obj[k]
  }
  categories.general = []
}

class Base {
  constructor(row) {
    Object.assign(this, row)
  }
  static get table() { return `${this.name.toLowerCase()}s` }
  static key = 'id'
}

export class Equipe extends Base{
  constructor(row) {
    super(row)
    this.tours = []
    this._has_changed = false
    addMonitoredValue(this, 'position_general')
    addMonitoredValue(this, 'position_categorie')
  }
  static key = 'equipe'
}
const addMonitoredValue = (obj, name) => {
  Object.defineProperty(obj, name, {
    enumerable: true,
    get() { return obj[`_${name}`] },
    set(value) {
      if (obj[`_${name}`] !== value) {
        obj._has_changed = true
      }
      Object.defineProperty(obj, `_${name}`, {
        value,
        enumerable: false,
        writable: true
      })
    },
  })
}

export class Equipier extends Base {
  constructor(row) {
    super(row)
    this.transpondeurs = []
  }
  static key = 'dossard'
}

export class Tour extends Base {
  constructor(row) {
    super(row)
    Object.defineProperty(this, 'duree', {
      enumerable: true,
      get() {
        if (this.status) return null
        const equipe = equipes[String(this.dossard).slice(0, -1)]
        if (!equipe) return null
        let previousIndex = equipe.tours.indexOf(this) - 1
        let previous = equipe.tours[previousIndex]
        while (previous && previous?.status) {
          previous = equipe.tours[--previousIndex]
        }
        return this.timestamp - (previous?.timestamp || 0)
      },
    })
  }
}

export class Transpondeur extends Base {
}

export const isSameEquipe = (t1, t2 = {}) => String(t1.dossard).slice(0, -1) === String(t2.dossard).slice(0, -1)
