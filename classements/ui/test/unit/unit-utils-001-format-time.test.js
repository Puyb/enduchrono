const { formatTime } = require('../../src/utils')

describe('utils.formatTime unit', () => {
  it('UNIT-UTILS-001 - retourne une chaine vide sur valeur invalide (0, NaN, undefined, null)', () => {
    expect(formatTime(0)).toBe('')
    expect(formatTime(NaN)).toBe('')
    expect(formatTime(undefined)).toBe('')
    expect(formatTime(null)).toBe('')
    expect(formatTime(Infinity)).toBe('')
  })

  it('UNIT-UTILS-001 - formatte au format HH:MM:SS.mmm', () => {
    expect(formatTime(3661001)).toBe('01:01:01.001')
  })

  it('UNIT-UTILS-001 - cas limite: secondes seules sous la minute', () => {
    expect(formatTime(5000)).toBe('00:00:05.000')
  })

  it('UNIT-UTILS-001 - cas limite: heures multiples sans plafond a 24h', () => {
    expect(formatTime(90061000)).toBe('25:01:01.000')
  })

  it('UNIT-UTILS-001 - cas limite: grandes valeurs (plusieurs jours)', () => {
    expect(formatTime(360000000)).toBe('100:00:00.000')
  })
})
