const { insertTourDescending, resetTours } = require('../../src/utils')

// Reproduit puis valide le correctif du glitch de chrono observe au demarrage
// d'une course (l'affichage alternait entre le temps ecoule depuis le vrai
// depart et un temps plus grand, herite du mode TEST precedent).
//
// `classements/ui/src/main.js` maintient un buffer glissant `tours` de
// MAX_LIVE_TOURS = 100 elements, alimente par `onNewTour` (main.js:155-157) :
//   insertTourDescending(tours, tour)
//   if (tours.length > MAX_LIVE_TOURS) tours.pop()
//
// et un `setInterval` (main.js:109-116) qui utilise `tours[0]` (le plus
// recent, puisque le tableau est trie par timestamp DECROISSANT) pour
// resynchroniser l'horloge affichee (`startDate`).
//
// Correctif applique :
// - `main.js` appelle desormais `resetTours(this.$store.state.tours)` des que
//   le statut passe a TEST ou COURSE (evenement `course`), car c'est a ces
//   deux moments que le compteur materiel est remis a zero (chrono.js
//   `start()`, appele par `/test/start` ET `/course/start` ; `/test/stop` ne
//   fait qu'arreter le compteur, sans le reinitialiser, donc pas de reset
//   necessaire a ce moment-la).
// - `main.js` lit `tours[0]` (le plus recent) au lieu de `last(tours)` (qui
//   pointait vers le plus ancien du buffer depuis le tri decroissant
//   introduit par le commit 9d8d194).
//
// Ces tests reproduisent ce scenario avec les fonctions reelles
// `insertTourDescending`/`resetTours`, en appelant `resetTours` exactement
// entre les tours d'avant et d'apres le (re)depart, comme le fait `main.js`.
describe('buffer live de tours (main.js) apres redemarrage TEST -> COURSE', () => {
  const MAX_LIVE_TOURS = 100

  it("UNIT-UTILS-005 - avec resetTours() au (re)depart, les tours de course ne disparaissent plus du buffer live", () => {
    const tours = []

    // Buffer rempli pendant le TEST : timestamps materiels croissants (10s a 1000s).
    for (let i = 1; i <= MAX_LIVE_TOURS; i++) {
      insertTourDescending(tours, { timestamp: i * 10000, status: 'ignore' })
      if (tours.length > MAX_LIVE_TOURS) tours.pop()
    }

    // Le vrai depart de course reinitialise le compteur materiel a 0 : on vide
    // le buffer live a cet instant precis, avant que les tours de la vraie
    // course (timestamps petits) ne commencent a arriver.
    resetTours(tours)

    const raceTours = []
    for (let i = 1; i <= 10; i++) {
      const tour = { timestamp: i * 100, status: null }
      raceTours.push(tour)
      insertTourDescending(tours, tour)
      if (tours.length > MAX_LIVE_TOURS) tours.pop()
    }

    // Les 10 tours de course qui viennent de se produire restent visibles
    // dans le buffer live : plus de vieux tours de TEST pour les evincer.
    const toursDeCourseEncorePresents = tours.filter(t => t.status === null)
    expect(toursDeCourseEncorePresents.length).toBe(raceTours.length)
  })

  it("UNIT-UTILS-005 - avec resetTours() + tours[0], l'horloge se resynchronise sur le tour de course le plus recent", () => {
    const tours = []

    for (let i = 1; i <= MAX_LIVE_TOURS; i++) {
      insertTourDescending(tours, { timestamp: i * 10000, status: 'ignore' })
      if (tours.length > MAX_LIVE_TOURS) tours.pop()
    }

    resetTours(tours)

    let dernierTourCourse
    for (let i = 1; i <= 10; i++) {
      dernierTourCourse = { timestamp: i * 100, status: null }
      insertTourDescending(tours, dernierTourCourse)
      if (tours.length > MAX_LIVE_TOURS) tours.pop()
    }

    // C'est ce que fait main.js:110 pour resynchroniser `startDate` :
    // `const lastTour = this.$store.state.tours[0]`. Avec le reset au (re)depart
    // et la lecture du bon index, ce dernier pointe bien vers le tour de course
    // le plus recent (timestamp 1000), plus aucun vieux tour de TEST ne peut
    // plus s'interposer.
    expect(tours[0]).toBe(dernierTourCourse)
  })
})
