const { formatTime, parseTime } = require('../../src/utils')

describe('utils.parseTime unit', () => {
  it('UNIT-UTILS-002 - parse le format complet HH:MM:SS.mmm', () => {
    expect(parseTime('01:01:01.001')).toBe(3661001)
  })

  it('UNIT-UTILS-002 - parse les variantes partielles MM:SS.mmm et SS.mmm', () => {
    expect(parseTime('01:05.500')).toBe(65500)
    expect(parseTime('05.500')).toBe(5500)
  })

  it('UNIT-UTILS-002 - coherence aller-retour partielle avec formatTime', () => {
    const value = 3661001
    expect(parseTime(formatTime(value))).toBe(value)
  })

  it('UNIT-UTILS-002 - cas invalides: retourne NaN sans lever d\'exception', () => {
    expect(Number.isNaN(parseTime(''))).toBe(true)
    expect(Number.isNaN(parseTime('abc'))).toBe(true)
  })
})
