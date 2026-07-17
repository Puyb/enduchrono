'use strict';

export const tours = []
export const transpondeurs = {}
export const equipes = {}
export const equipiers = {}
export const categories = { general: [] }
export const STATUS = ['TEST', 'DEPART', 'COURSE', 'FIN']

// Agregats incrementaux maintenus a cote des tours (evite de rescanner `tours` en entier)
export const toursCounts = {
  ignore: { total: 0, unknown: 0 },
  null: { total: 0, unknown: 0 },
  duplicate: { total: 0, unknown: 0 },
  deleted: { total: 0, unknown: 0 },
}
export const toursPerMinute = {}

export const adjustTourCount = (tour, statusKey, delta) => {
  const bucket = toursCounts[statusKey]
  bucket.total += delta
  if (!tour.dossard) bucket.unknown += delta
}

export const adjustToursPerMinute = (timestamp, delta) => {
  const bucket = Math.floor(timestamp / 60000) * 60000
  toursPerMinute[bucket] = (toursPerMinute[bucket] || 0) + delta
  if (toursPerMinute[bucket] <= 0) delete toursPerMinute[bucket]
}

export const reset = () => {
  tours.length = 0
  for (const obj of [ transpondeurs, equipes, equipiers, categories ]) {
    for (const k in obj) delete obj[k]
  }
  categories.general = []
  for (const bucket of Object.values(toursCounts)) {
    bucket.total = 0
    bucket.unknown = 0
  }
  for (const k in toursPerMinute) delete toursPerMinute[k]
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

// Recherche par id plutot que par reference : permet de calculer duree/numeroEquipe
// sur un Tour reconstruit hors du singleton vivant dans `tours` (ex. instancie a
// partir d'une row SQL par la route GET /tours), pas seulement sur l'instance
// canonique presente dans equipe.tours.
const indexInEquipe = (equipe, tour) => equipe.tours.findIndex(t => t.id === tour.id)

export class Tour extends Base {
  constructor(row) {
    super(row)
    Object.defineProperty(this, 'duree', {
      enumerable: true,
      get() {
        if (this.status) return null
        const equipe = equipes[String(this.dossard).slice(0, -1)]
        if (!equipe) return null
        let previousIndex = indexInEquipe(equipe, this) - 1
        let previous = equipe.tours[previousIndex]
        while (previous && previous?.status) {
          previous = equipe.tours[--previousIndex]
        }
        return this.timestamp - (previous?.timestamp || 0)
      },
    })
    Object.defineProperty(this, 'numeroEquipe', {
      enumerable: true,
      get() {
        if (this.status) return null
        const equipe = equipes[String(this.dossard).slice(0, -1)]
        if (!equipe) return null
        const index = indexInEquipe(equipe, this)
        return index === -1 ? null : index + 1
      },
    })
  }
}

export class Transpondeur extends Base {
}

export const isSameEquipe = (t1, t2 = {}) => String(t1.dossard).slice(0, -1) === String(t2.dossard).slice(0, -1)
