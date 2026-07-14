function sanitizeCourseName(name) {
  return name.replace(/[^a-z0-9.()-]+/gi, '_')
}

function createCourseFixture(seedLabel = 'fixture') {
  const seed = `${Date.now()}${Math.floor(Math.random() * 1000)}`.replace(/\D/g, '').slice(-12)
  const courseName = `ui_${seedLabel}_${seed}`

  const teams = {
    team1: { equipe: 1, dossard: 11, transpondeur: 'TRP-A-11', categorie: 'A', nom: 'Equipe 1' },
    team2: { equipe: 2, dossard: 21, transpondeur: 'TRP-A-21', categorie: 'A', nom: 'Equipe 2' },
    team3: { equipe: 3, dossard: 31, transpondeur: 'TRP-B-31', categorie: 'B', nom: 'Equipe 3' },
  }

  return {
    courseName,
    courseFilename: `${sanitizeCourseName(courseName)}.db`,
    unknownTranspondeur: 'TRP-UNKNOWN-99',
    teams,
    equipesCsv: [
      'equipe,nom,categorie,penalite,deleted',
      '1,Equipe 1,A,0,0',
      '2,Equipe 2,A,0,0',
      '3,Equipe 3,B,0,0',
    ].join('\n'),
    equipiersCsv: [
      'equipe,dossard,nom,prenom,deleted',
      '1,11,Nom11,Prenom11,0',
      '2,21,Nom21,Prenom21,0',
      '3,31,Nom31,Prenom31,0',
    ].join('\n'),
    transpondeursCsv: [
      'id,dossard,deleted,vu,battery',
      `${teams.team1.transpondeur},11,0,0,`,
      `${teams.team2.transpondeur},21,0,0,`,
      `${teams.team3.transpondeur},31,0,0,`,
      'TRP-UNKNOWN-99,,0,0,',
    ].join('\n'),
  }
}

module.exports = {
  createCourseFixture,
}
