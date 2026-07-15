const { formatDuree } = require('../../src/utils')

describe('utils.formatDuree unit', () => {
  it('UNIT-UTILS-003 - retourne une chaine vide sur valeur invalide (0)', () => {
    expect(formatDuree(0)).toBe('')
  })

  it('UNIT-UTILS-003 - affichage compact sans zeros de tete (minutes:secondes)', () => {
    expect(formatDuree(65500)).toBe('1:05.500')
  })

  it('UNIT-UTILS-003 - cas limite: duree sub-seconde', () => {
    expect(formatDuree(500)).toBe('0.500')
    expect(formatDuree(999)).toBe('0.999')
  })

  it('UNIT-UTILS-003 - cas limite: longue duree (heures)', () => {
    expect(formatDuree(7384001)).toBe('2:03:04.001')
  })
})
