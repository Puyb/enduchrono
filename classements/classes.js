'use strict';

const tours = []
const transpondeurs = {}
const equipes = {}
const equipiers = {}
const categories = { general: [] }

class Base {
  constructor(row) {
    Object.assign(this, row)
  }
  static get table() { return `${this.name.toLowerCase()}s` }
  static key = 'id'
}

class Equipe extends Base{
  constructor(row) {
    super(row)
    this.tours = []
    this.duplicate = []
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

class Equipier extends Base {
  constructor(row) {
    super(row)
    this.transpondeurs = []
  }
  static key = 'dossard'
}

class Tour extends Base {
  constructor(row) {
    super(row)
    Object.defineProperty(this, 'duree', {
      enumerable: true,
      get() {
        if (this.duplicate || this.deleted) return
        const equipe = equipes[String(this.dossard).slice(0, -1)]
        if (!equipe) return null
        let previousIndex = equipe.tours.indexOf(this) - 1
        let previous = equipe.tours[previousIndex]
        while (previous && (previous?.duplicate || previous?.deleted)) {
          previous = equipe.tours[--previousIndex]
        }
        return this.timestamp - (previous?.timestamp || 0)
      },
    })
  }
}

class Transpondeur extends Base {
}

const isSameEquipe = (t1, t2 = {}) => String(t1.dossard).slice(0, -1) === String(t2.dossard).slice(0, -1)

module.exports = {
  Equipe,
  Equipier,
  Tour,
  Transpondeur,
  tours,
  transpondeurs,
  equipes,
  equipiers,
  categories,
}
