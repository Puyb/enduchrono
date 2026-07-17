import { expect } from 'chai'
import { Equipe, Tour, equipes } from '../classes.js';

describe('Equipe - addMonitoredValue', () => {
  let equipe;
  beforeEach(() => {
    equipe = new Equipe({ equipe: 1 });
  });

  it('should initialize position_general and position_categorie as monitored properties', () => {
    expect(equipe).to.have.property('position_general');
    expect(equipe).to.have.property('position_categorie');
  });

  it('should set _has_changed to true when position_general is modified', () => {
    equipe.position_general = 1;
    expect(equipe._has_changed).to.be.true;
  });

  it('should set _has_changed to true when position_categorie is modified', () => {
    equipe.position_categorie = 2;
    expect(equipe._has_changed).to.be.true;
  });

  it('should not change _has_changed when position_general is not modified', () => {
    equipe.position_general = 1
    equipe._has_changed = false
    equipe.position_general = 1
    expect(equipe._has_changed).to.be.false
  });

  it('should not change _has_changed when position_categorie is not modified', () => {
    equipe.position_categorie = 1
    equipe._has_changed = false
    equipe.position_categorie = 1
    expect(equipe._has_changed).to.be.false
  });
});


describe('Tour - duree', () => {
  
  let equipe

  beforeEach(() => {
    equipe = new Equipe({ equipe: 1 })
    equipe.tours = [
      new Tour({ id: 1, dossard: 11, timestamp: 1000 }),
      new Tour({ id: 2, dossard: 12, timestamp: 2000 }),
    ]
    equipes[1] = equipe
  })

  it('should calculate the duration between two consecutive tours', () => {
    // Durée = 2000 - 1000 = 1000
    expect(equipe.tours[1].duree).to.equal(1000)
  })

  it('should return null for duration if the tour status is deleted', () => {
    equipe.tours[1].status = 'deleted'

    expect(equipe.tours[1].duree).to.equal(null)
  })

  it('should calculate duration correctly for a new tour added to the team', () => {
    const newTour = new Tour({ id: 3, dossard: 13, timestamp: 3000 })
    equipe.tours.push(newTour)

    // La durée du nouveau tour sera de 3000 - 2000 = 1000
    expect(newTour.duree).to.equal(1000)
  })

  it('should calculate duration correctly even if a previous tour is not valid', () => {
    equipe.tours[1].status = 'deleted' // Tour terminé
    equipe.tours.push(new Tour({ id: 3, dossard: 12, timestamp: 3000, status: 'ignore' }))
    equipe.tours.push(new Tour({ id: 4, dossard: 11, timestamp: 4000, status: 'ignore' }))
    equipe.tours.push(new Tour({ id: 5, dossard: 13, timestamp: 5000 }))


    expect(equipe.tours[4].duree).to.equal(4000)
  })

  it('should compute duration from race start when all previous tours are non-counting', () => {
    equipe.tours[0].status = 'ignore'
    equipe.tours[1].status = 'duplicate'
    equipe.tours.push(new Tour({ id: 3, dossard: 11, timestamp: 3000 }))
    expect(equipe.tours[2].duree).to.equal(3000)
  })

})
