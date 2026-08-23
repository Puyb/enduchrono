const { formatDateTime } = require('../../src/utils')

describe('utils.formatDateTime unit', () => {
  it('UNIT-UTILS-006 - retourne une chaine vide sur valeur invalide (0, NaN, undefined, null)', () => {
    expect(formatDateTime(0)).toBe('')
    expect(formatDateTime(NaN)).toBe('')
    expect(formatDateTime(undefined)).toBe('')
    expect(formatDateTime(null)).toBe('')
  })

  it('UNIT-UTILS-006 - formatte un timestamp epoch en date/heure locale', () => {
    const timestamp = Date.UTC(2026, 0, 15, 10, 30, 0)
    expect(formatDateTime(timestamp)).toBe(new Date(timestamp).toLocaleString())
  })
})
