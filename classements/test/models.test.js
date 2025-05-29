/* global describe, it, beforeEach */
import { expect } from 'chai'
import sinon from 'sinon'
import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinonChai from 'sinon-chai'
import _ from "lodash";
import * as models from '../models.js'
import { isDuplicate, rankValue, calculClassementCategory, addTourToEquipe } from '../models.js'
import { categories, tours } from '../classes.js'

chai.use(chaiAsPromised)
chai.use(sinonChai)
chai.should()


// Global variables
const COURSE_DUREE = 6 * 3600 * 1000
const DUPLICATE_WINDOW_PERIOD = 500

describe('isDuplicate', function()  {
  let team

  beforeEach(function()  {
    team = { tours: [] }
  })

  it('should return false if the team has no tours', function()  {
    const result = isDuplicate(500, team, DUPLICATE_WINDOW_PERIOD)
    expect(result).to.be.false
  })

  it('should return false if no tour is within the duplication window', function()  {
    team.tours = [{ timestamp: 100, status: null }, { timestamp: 1000, status: null }]
    const result = isDuplicate(1600, team, DUPLICATE_WINDOW_PERIOD)
    expect(result).to.be.false
  })

  it('should return true if a timestamp falls within the duplication window', function()  {
    team.tours = [{ timestamp: 100, status: null }, { timestamp: 1000, status: null }]
    const result = isDuplicate(1200, team, DUPLICATE_WINDOW_PERIOD)
    expect(result).to.be.true
  })

  it('should return false if a tour is already duplicated in the window', function()  {
    team.tours = [{ timestamp: 500, status: null }, { timestamp: 900, status: 'duplicated' }]
    const result = isDuplicate(1200, team, DUPLICATE_WINDOW_PERIOD)
    expect(result).to.be.false
  })

  it('should return false if a tour is already duplicated in the window', function()  {
    team.tours = [{ timestamp: 800, status: null }, { timestamp: 900, status: 'duplicated' }]
    const result = isDuplicate(1200, team, DUPLICATE_WINDOW_PERIOD)
    expect(result).to.be.true
  })

  it('should return true if lastTimestamp is greater than COURSE_DUREE and timestamp >= lastTimestamp', function()  {
    team.tours = [{ timestamp: COURSE_DUREE + 100, status: null }]
    const result = isDuplicate(COURSE_DUREE + 1000, team, DUPLICATE_WINDOW_PERIOD)
    expect(result).to.be.true
  })

  it('should return false if lastTimestamp <= COURSE_DUREE and timestamp >= lastTimestamp', function()  {
    team.tours = [{ timestamp: 900, status: null }]
    const result = isDuplicate(1500, team, DUPLICATE_WINDOW_PERIOD)
    expect(result).to.be.false
  })
})

describe('rankValue', function() {
  it('should return a smaller value for the team with the biggest number of laps', function() {
    const equipe1 = { tours: [1, 2, 3, 4], temps: 12345, penalite: 0 }
    const equipe2 = { tours: [1, 2, 3], temps: 12345, penalite: 0 }
    expect(rankValue(equipe1)).to.be.below(rankValue(equipe2))
  })
  it('should return a smaller value for the team with the biggest number of laps including penalty', function() {
    const equipe1 = { tours: [1, 2, 3, 4], temps: 12345, penalite: 1 }
    const equipe2 = { tours: [1, 2, 3], temps: 12345, penalite: 0 }
    expect(rankValue(equipe1)).to.be.below(rankValue(equipe2))
  })
  it('should return a smaller value for the team with the samllest timestamp if both teams have the same number of laps', function() {
    const equipe1 = { tours: [1, 2, 3], temps: 12344, penalite: 0 }
    const equipe2 = { tours: [1, 2, 3], temps: 12345, penalite: 0 }
    expect(rankValue(equipe1)).to.be.below(rankValue(equipe2))
  })
})

describe('calculClassementCategory', () => {
  beforeEach(() => {
    categories.SNX = [
      { equipe: 1, tours: [1, 2, 3], penalite: 0, temps: 5000 },
      { equipe: 2, tours: [1, 2], penalite: 1, temps: 6000 },
      { equipe: 3, tours: [], penalite: 0, temps: null },
      { equipe: 4, tours: [1, 2, 3, 4], penalite: 0, temps: 4500 },
    ]
    categories.general = [
      { equipe: 5, tours: [1, 2, 3], penalite: 2, temps: 5500 },
      { equipe: 6, tours: [1], penalite: 0, temps: 7000 },
      { equipe: 7, tours: [1, 2, 3, 4, 5], penalite: 0, temps: 4800 },
      { equipe: 8, tours: [], penalite: 0, temps: null },
    ]
    for (const category of Object.values(categories)) {
      for (const team of category) {
        team._rank = rankValue(team)
      }
    }
  })

  it('should correctly rank teams in SNX category', () => {
    calculClassementCategory('SNX')
   
    const expectedOrder = [4, 1, 2, 3]
    expect(categories.SNX.map(team => team.equipe)).to.deep.equal(expectedOrder)
   
    expect(categories.SNX[0]).to.have.property('position_categorie', 1)
    expect(categories.SNX[1]).to.have.property('position_categorie', 2)
    expect(categories.SNX[2]).to.have.property('position_categorie', 3)
  })

  it('should correctly rank teams in general category', () => {
    calculClassementCategory('general')
   
    const expectedOrder = [7, 5, 6, 8]
    expect(categories.general.map(team => team.equipe)).to.deep.equal(expectedOrder)
   
    expect(categories.general[0]).to.have.property('position_general', 1)
    expect(categories.general[1]).to.have.property('position_general', 2)
    expect(categories.general[2]).to.have.property('position_general', 3)
  })

  it('should not assign a position to teams without laps', () => {
    calculClassementCategory('SNX')

    const unrankedTeam = categories.SNX.find(team => team.tours.length === 0)
    expect(unrankedTeam).to.not.have.property('position_categorie')
  })

  it('should not assign a position to teams without laps', () => {
    calculClassementCategory('general')

    const unrankedTeam = categories.SNX.find(team => team.tours.length === 0)
    expect(unrankedTeam).to.not.have.property('position_general')
  })
})

describe("addTourToEquipe", () => {
  let equipe;

  beforeEach(() => {
    equipe = {
      tours: [
        { timestamp: 1000 },
        { timestamp: 2000 },
        { timestamp: 3000 }
      ],
      penalite: 1,
      temps: 3000,
      _has_changed: false
    };
    equipe._rank = rankValue(equipe)
  });

  it("should add a tour to the end if it has the most recent timestamp", () => {
    const newTour = { timestamp: 4000 };
    addTourToEquipe(equipe, newTour);

    expect(_.last(equipe.tours)).to.deep.equal(newTour);
    expect(equipe.tours.length).to.equal(4);
  });

  it("should insert a tour at the correct position if timestamp is not the most recent", () => {
    const newTour = { timestamp: 2500 };
    addTourToEquipe(equipe, newTour);

    expect(equipe.tours[2]).to.deep.equal(newTour);
    expect(equipe.tours.length).to.equal(4);
  });

  it("should set _has_changed to true after adding a tour", () => {
    const newTour = { timestamp: 3500 };
    addTourToEquipe(equipe, newTour);

    expect(equipe._has_changed).to.be.true;
  });

  it("should update _rank after adding a tour", () => {
    const initialRank = equipe._rank;
    const newTour = { timestamp: 4000 };
    addTourToEquipe(equipe, newTour);

    expect(equipe._rank).to.not.equal(initialRank);
    expect(equipe._rank).to.equal(rankValue(equipe));
  });

  it("should update temps if the new tour has a higher timestamp", () => {
    const newTour = { timestamp: 5000 };
    addTourToEquipe(equipe, newTour);

    expect(equipe.temps).to.equal(5000);
  });

  it("should not update temps if the new tour has a lower timestamp", () => {
    const newTour = { timestamp: 1500 };
    addTourToEquipe(equipe, newTour);

    expect(equipe.temps).to.equal(3000); // Temps should remain the same
  });
});

describe('insertTour', () => {
  let knex;
  beforeEach(() => {
    // Simulons knex
    knex = {}
    knex.insert = sinon.stub().callsFake(() => knex)
    knex.into = sinon.stub().resolves([42]) // id retourné

    // Simuler les dépendances globales
    models.setKnex(knex)
    tours.length = 0
  })

  it('should insert a new tour and assign returned id', async () => {
    const tour = { name: 'Tour 1', timestamp: 1000 }

    await models.insertTour(tour)

    tour.should.have.property('id', 42)
    knex.insert.should.have.been.calledWith(_.omit(tour, ['id', 'duree']))
    knex.into.should.have.been.calledWith('tours')
    tours.should.deep.equal([tour])
  })

  it('should insert tour at correct position if timestamp is earlier than last', async () => {
    const existingTours = [
      { id: 1, name: 'Old Tour', timestamp: 2000 }
    ]
    tours.push(...existingTours)

    const newTour = { name: 'New Tour', timestamp: 1500 }

    await models.insertTour(newTour)

    newTour.should.have.property('id', 42)
    tours.should.deep.equal([newTour, ...existingTours])
  })

  it('should push tour at end if timestamp is greater than last', async () => {
    const existingTours = [
      { id: 1, name: 'Old Tour', timestamp: 1000 }
    ]
    tours.push(...existingTours)

    const newTour = { name: 'New Tour', timestamp: 2000 }

    await models.insertTour(newTour)

    tours.should.deep.equal([...existingTours, newTour])
  })

  it('should insert tour at beginning if timestamp is the smallest', async () => {
    const existingTours = [
      { id: 1, name: 'Mid Tour', timestamp: 1500 },
      { id: 2, name: 'Late Tour', timestamp: 2000 }
    ]
    tours.push(...existingTours)

    const newTour = { name: 'Early Tour', timestamp: 1000 }

    await models.insertTour(newTour)

    tours[0].name.should.equal('Early Tour')
  })

  it('should insert tour in the middle when timestamp fits between', async () => {
    const existingTours = [
      { id: 1, name: 'Tour A', timestamp: 1000 },
      { id: 2, name: 'Tour C', timestamp: 3000 }
    ]
    tours.push(...existingTours)

    const newTour = { name: 'Tour B', timestamp: 2000 }

    await models.insertTour(newTour)

    tours.map(t => t.name).should.deep.equal(['Tour A', 'Tour B', 'Tour C'])
  })
})

