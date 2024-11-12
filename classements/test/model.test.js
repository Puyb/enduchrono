import t from 'tap'
import { rankValue, updateClassement, categories } from '../models.js'

t.test('rankValue', async function() {
  const equipe1 = { tours: [1, 2, 3], penalite: 0, temps: 1000 }
  const equipe2 = { tours: [1, 2, 3], penalite: 0, temps: 1001 }
  const equipe3 = { tours: [1, 2, 3, 4], penalite: 0, temps: 1001 }
  const equipe4 = { tours: [1, 2, 3, 4], penalite: -1, temps: 1001 }
  t.ok(rankValue(equipe1) < rankValue(equipe2))
  t.ok(rankValue(equipe3) < rankValue(equipe2))
  t.ok(rankValue(equipe3) < rankValue(equipe4))
})

t.test('updateClassement 4 -> 2, 3 -> 1', async function() {
  const e = [
    { _rank: -5, position_general: 1, position_categorie: 1, categorie: 'IDH' },
    { _rank: -4, position_general: 2, position_categorie: 1, categorie: 'SNX' },
    { _rank: -3, position_general: 3, position_categorie: 2, categorie: 'IDH' },
    { _rank: -2, position_general: 4, position_categorie: 2, categorie: 'SNX' },
    { _rank: -1, position_general: 5, position_categorie: 3, categorie: 'IDH' },
  ]
  categories['general'] = [...e]
  categories['SNX'] = [e[1], e[3]]
  e[3]._rank = -4.5
  updateClassement(e[3])
  t.same(categories.general, [e[0], e[3], e[1], e[2], e[4]])
  t.same(categories.SNX, [e[3], e[1]])
  t.equal(e[0].position_general, 1)
  t.equal(e[3].position_general, 2)
  t.equal(e[1].position_general, 3)
  t.equal(e[2].position_general, 4)
  t.equal(e[4].position_general, 5)
  t.equal(e[3].position_categorie, 1)
  t.equal(e[1].position_categorie, 2)
})
