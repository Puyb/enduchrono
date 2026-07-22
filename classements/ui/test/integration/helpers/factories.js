function createEquipe(overrides = {}) {
  return {
    equipe: 1,
    nom: 'Equipe 1',
    categorie: 'A',
    tours: 10,
    penalite: 0,
    temps: 3600000,
    position_general: 1,
    position_categorie: 1,
    gerant_nom: 'Gerant',
    gerant_prenom: 'Prenom',
    ...overrides,
  }
}

function createEquipier(overrides = {}) {
  return {
    dossard: 11,
    nom: 'Nom11',
    prenom: 'Prenom11',
    sexe: 'M',
    transpondeurs: [],
    ...overrides,
  }
}

function createTour(overrides = {}) {
  return {
    id: 1,
    dossard: 11,
    transpondeur: 'TRP-11',
    timestamp: 60000,
    duree: 60000,
    status: null,
    ...overrides,
  }
}

function createTranspondeur(overrides = {}) {
  return {
    id: 'TRP-11',
    dossard: 11,
    deleted: false,
    ...overrides,
  }
}

function createStoreState(overrides = {}) {
  return {
    URL: 'http://classements.test',
    course: { status: 'COURSE' },
    time: 0,
    error: null,
    errorMessage: null,
    tours: [],
    toursCounts: { all: 0, normaux: 0, duplicate: 0, deleted: 0, unknown: 0 },
    toursPerMinute: {},
    newToursSincePage1: 0,
    toursLiveMode: true,
    wsInitCount: 0,
    equipes: {},
    equipiers: {},
    transpondeurs: [],
    categories: [],
    filenames: [],
    noise: [],
    ...overrides,
  }
}

// bootstrap-vue expose $bvModal via un getter en lecture seule sur Vue.prototype
// qui retourne `this._bv__modal`. On ne peut donc pas mocker $bvModal via les
// `mocks` de vue-test-utils : on remplace directement l'instance privee.
function stubBvModal(vm, confirmResult = true) {
  const mock = {
    msgBoxConfirm: jest.fn().mockResolvedValue(confirmResult),
    show: jest.fn(),
  }
  vm._bv__modal = mock
  return mock
}

module.exports = {
  createEquipe,
  createEquipier,
  createTour,
  createTranspondeur,
  createStoreState,
  stubBvModal,
}
