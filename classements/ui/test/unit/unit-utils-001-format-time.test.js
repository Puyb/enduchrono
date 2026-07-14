const { formatTime, parseTime, rankValue } = require('../../src/utils')

describe('utils unit', () => {
  it('UNIT-UTILS-001 formatte et parse un temps de course en millisecondes', () => {
    const value = 3661001
    expect(formatTime(value)).toBe('01:01:01.001')
    expect(parseTime('01:01:01.001')).toBe(value)
  })

  it('UNIT-UTILS-002 privilegie le nombre de tours dans la valeur de classement', () => {
    const equipeA = { tours: 2, penalite: 0, temps: 999999 }
    const equipeB = { tours: 1, penalite: 0, temps: 1 }
    expect(rankValue(equipeA)).toBeLessThan(rankValue(equipeB))
  })
})
