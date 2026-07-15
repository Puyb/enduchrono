const { rankValue } = require('../../src/utils')

describe('utils.rankValue unit', () => {
  it('UNIT-UTILS-004 - priorite au nombre de tours (+ penalite/bonus) sur le temps', () => {
    const plusDeTours = { tours: 2, penalite: 0, temps: 999999 }
    const moinsDeTours = { tours: 1, penalite: 0, temps: 1 }
    expect(rankValue(plusDeTours)).toBeLessThan(rankValue(moinsDeTours))

    const avecBonus = { tours: 1, penalite: 1, temps: 999999 }
    const sansBonus = { tours: 1, penalite: 0, temps: 1 }
    expect(rankValue(avecBonus)).toBeLessThan(rankValue(sansBonus))

    const avecPenalite = { tours: 2, penalite: -1, temps: 1 }
    const sansPenalite = { tours: 2, penalite: 0, temps: 999999 }
    expect(rankValue(avecPenalite)).toBeGreaterThan(rankValue(sansPenalite))
  })

  it('UNIT-UTILS-004 - a tours egaux (penalite incluse), priorite au temps le plus court', () => {
    const plusRapide = { tours: 3, penalite: 0, temps: 1000 }
    const plusLent = { tours: 3, penalite: 0, temps: 2000 }
    expect(rankValue(plusRapide)).toBeLessThan(rankValue(plusLent))
  })

  it('UNIT-UTILS-004 - fonction pure et indifferente a la categorie', () => {
    const equipeA = { tours: 5, penalite: 0, temps: 12345, categorie: 'Senior' }
    const equipeB = { tours: 5, penalite: 0, temps: 12345, categorie: 'Junior' }
    expect(rankValue(equipeA)).toBe(rankValue(equipeB))
    expect(rankValue(equipeA)).toBe(rankValue(equipeA))
  })
})
